import {
  characterAt,
  FONT_SIZE,
  STRIKE_Y,
  STROKE,
  UNDERLINE_Y,
  type LineLayout,
} from './line';
import {
  characterStyles,
  IMAGE_HEIGHT,
  THRESHOLD,
  TOKEN_WIDTH,
  type AttentionMap,
  type CharacterReading,
} from './preprocessing';

type Channel = 'strike' | 'underline';

const CHANNELS: readonly Channel[] = ['strike', 'underline'];
const PLOT_HEIGHT = 44;
const BAR_GAP = 2;
// Hides the hairline seams between per-character marks at fractional scales.
const MARK_OVERLAP = 0.5;
const SVG = 'http://www.w3.org/2000/svg';
const HEAT: readonly [number, number, number] = [233, 160, 0];
const RAMP: readonly (readonly [number, number, number, number])[] = [
  [0, 255, 255, 255],
  [0.55, ...HEAT],
  [1, 74, 36, 0],
];

const svgElement = (
  name: string,
  attributes: Readonly<Record<string, string | number>>,
) => {
  const element = document.createElementNS(SVG, name);
  Object.entries(attributes).forEach(([key, value]) =>
    element.setAttribute(key, String(value)),
  );
  return element;
};

const probabilityY = (probability: number) => PLOT_HEIGHT * (1 - probability);

const rule = (name: string, width: number, y: number) =>
  svgElement('line', { class: name, x1: 0, x2: width, y1: y, y2: y });

const channelMarks = (
  { width, characters }: LineLayout,
  readings: readonly CharacterReading[],
  channel: Channel,
): readonly Element[] => [
  ...characters.map(({ x, width: advance }, index) => {
    const y = probabilityY(readings[index][channel]);
    return svgElement('rect', {
      class: 'bar',
      x: x + BAR_GAP / 2,
      y,
      width: Math.max(advance - BAR_GAP, 1),
      height: PLOT_HEIGHT - y,
    });
  }),
  rule('threshold', width, probabilityY(THRESHOLD)),
  rule('baseline', width, PLOT_HEIGHT - 0.5),
];

const ramped = (value: number): readonly number[] => {
  const end = RAMP.findIndex(([stop]) => value <= stop);
  const [low, ...from] = RAMP[Math.max(end - 1, 0)];
  const [high, ...to] = RAMP[end];
  const blend = high === low ? 0 : (value - low) / (high - low);
  return from.map((channel, index) => channel + (to[index] - channel) * blend);
};

/** Square root, so the long tail of a softmax stays visible beside its peak. */
const strength = (weight: number, peak: number) =>
  peak > 0 ? Math.sqrt(Math.min(weight / peak, 1)) : 0;

const heatImage = (
  { rows, columns, validColumns, weights }: AttentionMap,
  character: number,
  peak: number,
): ImageData => {
  const image = new ImageData(validColumns, rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < validColumns; column++) {
      const weight = weights[(character * rows + row) * columns + column];
      image.data.set(
        [...HEAT, 255 * strength(weight, peak)],
        (row * validColumns + column) * 4,
      );
    }
  }
  return image;
};

/** Each character's weight per column, flattened from `[characters, validColumns]`. */
const columnWeights = ({
  characters,
  rows,
  columns,
  validColumns,
  weights,
}: AttentionMap): Float32Array => {
  const summed = new Float32Array(characters * validColumns);
  for (let character = 0; character < characters; character++) {
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < validColumns; column++) {
        summed[character * validColumns + column] +=
          weights[(character * rows + row) * columns + column];
      }
    }
  }
  return summed;
};

const matrixImage = (
  { characters, validColumns }: AttentionMap,
  summed: Float32Array,
): ImageData => {
  const image = new ImageData(validColumns, characters);
  const peak = summed.reduce((top, weight) => Math.max(top, weight), 0);
  summed.forEach((weight, index) =>
    image.data.set([...ramped(strength(weight, peak)), 255], index * 4),
  );
  return image;
};

const visible = (character: string) => (character === ' ' ? '␣' : character);

const probability = (value: number) => value.toFixed(3);

const signed = (value: number) =>
  `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(2)}`;

const tableRow = (character: string, reading: CharacterReading) => {
  const row = document.createElement('tr');
  const header = document.createElement('th');
  header.scope = 'row';
  header.textContent = visible(character);
  row.append(
    header,
    ...CHANNELS.map((channel) => {
      const cell = document.createElement('td');
      cell.textContent = probability(reading[channel]);
      return cell;
    }),
  );
  return row;
};

const markElement = (y: number, left: number, width: number, total: number) => {
  const mark = document.createElement('i');
  mark.style.top = `${(y / IMAGE_HEIGHT) * 100}%`;
  mark.style.height = `${(STROKE / IMAGE_HEIGHT) * 100}%`;
  mark.style.left = `${(left / total) * 100}%`;
  mark.style.width = `${((width + MARK_OVERLAP) / total) * 100}%`;
  return mark;
};

const glyphElements = (
  { width: total, characters }: LineLayout,
  readings: readonly CharacterReading[],
): readonly Element[] => {
  const styles = characterStyles(readings);
  return characters.flatMap(({ character, x, width }, index) => {
    const { strike, underline } = styles[index];
    const glyph = document.createElement('span');
    glyph.textContent = character;
    glyph.style.left = `${(x / total) * 100}%`;
    return [
      glyph,
      ...(strike ? [markElement(STRIKE_Y, x, width, total)] : []),
      ...(underline ? [markElement(UNDERLINE_Y, x, width, total)] : []),
    ];
  });
};

export type CharacterChart = {
  readonly render: (
    layout: LineLayout,
    readings: readonly CharacterReading[],
    attention: AttentionMap,
  ) => void;
  /** Selects a character and scrolls it into view. */
  readonly focus: (index: number) => void;
  readonly clear: () => void;
};

type Drawn = {
  readonly layout: LineLayout;
  readonly readings: readonly CharacterReading[];
  readonly attention: AttentionMap;
  readonly heatPeak: number;
};

export const mountCharacterChart = (
  root: HTMLElement,
): CharacterChart | null => {
  const scroller = root.querySelector<HTMLElement>('.scroller');
  const overlay = root.querySelector<HTMLElement>('.overlay');
  const cursor = root.querySelector<HTMLElement>('.cursor');
  const rowMark = root.querySelector<HTMLElement>('.row-mark');
  const readout = root.querySelector<HTMLElement>('.readout');
  const table = root.querySelector<HTMLElement>('.values tbody');
  const glyphs = root.querySelector<HTMLElement>('.glyphs');
  const heat = root.querySelector<HTMLCanvasElement>('canvas.heat');
  const heatContext = heat?.getContext('2d');
  const matrix = root.querySelector<HTMLCanvasElement>('canvas.matrix');
  const matrixContext = matrix?.getContext('2d');
  const plots = CHANNELS.map((channel) =>
    root.querySelector<SVGSVGElement>(`svg[data-channel="${channel}"]`),
  );
  if (
    !scroller ||
    !overlay ||
    !cursor ||
    !rowMark ||
    !readout ||
    !table ||
    !glyphs ||
    !heat ||
    !heatContext ||
    !matrix ||
    !matrixContext ||
    plots.includes(null)
  ) {
    return null;
  }

  let drawn: Drawn | null = null;
  let selected = 0;

  const select = (index: number) => {
    if (!drawn) return;
    const { layout, readings, attention, heatPeak } = drawn;
    selected = Math.min(Math.max(index, 0), layout.characters.length - 1);
    const { character, x, width } = layout.characters[selected];
    heatContext.putImageData(heatImage(attention, selected, heatPeak), 0, 0);
    cursor.hidden = false;
    cursor.style.left = `${(x / layout.width) * 100}%`;
    cursor.style.width = `${(width / layout.width) * 100}%`;
    rowMark.hidden = false;
    rowMark.style.top = `${(selected / attention.characters) * 100}%`;
    rowMark.style.height = `${100 / attention.characters}%`;
    const { strike, underline, strikeLogit, underlineLogit } =
      readings[selected];
    readout.textContent = `“${visible(character)}” #${selected + 1}   strike ${probability(strike)} (logit ${signed(strikeLogit)})   underline ${probability(underline)} (logit ${signed(underlineLogit)})`;
  };

  const focus = (index: number) => {
    select(index);
    if (!drawn) return;
    const { x, width } = drawn.layout.characters[selected];
    const centre = ((x + width / 2) / drawn.layout.width) * overlay.offsetWidth;
    scroller.scrollLeft =
      overlay.offsetLeft + centre - scroller.clientWidth / 2;
  };

  const pointAt = ({ clientX }: PointerEvent) => {
    if (!drawn) return;
    const { left, width } = overlay.getBoundingClientRect();
    const x = ((clientX - left) / width) * drawn.layout.width;
    if (x < 0 || x > drawn.layout.width) return;
    const index = characterAt(drawn.layout, x);
    if (index !== selected) select(index);
  };
  scroller.addEventListener('pointermove', pointAt);
  scroller.addEventListener('pointerdown', pointAt);

  scroller.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    focus(selected + step);
  });

  return {
    render: (layout, readings, attention) => {
      const { validColumns, rows, characters } = attention;
      const coverage = `${((validColumns * TOKEN_WIDTH) / layout.width) * 100}%`;
      const summed = columnWeights(attention);
      drawn = {
        layout,
        readings,
        attention,
        heatPeak: attention.weights.reduce(
          (top, weight) => Math.max(top, weight),
          0,
        ),
      };
      heat.width = validColumns;
      heat.height = rows;
      heat.style.width = coverage;
      matrix.width = validColumns;
      matrix.height = characters;
      matrix.style.width = coverage;
      matrixContext.putImageData(matrixImage(attention, summed), 0, 0);
      CHANNELS.forEach((channel, index) => {
        const plot = plots[index]!;
        plot.setAttribute('viewBox', `0 0 ${layout.width} ${PLOT_HEIGHT}`);
        plot.replaceChildren(...channelMarks(layout, readings, channel));
      });
      glyphs.style.fontSize = `calc(100cqw / ${layout.width} * ${FONT_SIZE})`;
      glyphs.replaceChildren(...glyphElements(layout, readings));
      table.replaceChildren(
        ...layout.characters.map(({ character }, index) =>
          tableRow(character, readings[index]),
        ),
      );
      select(selected);
    },
    focus,
    clear: () => {
      drawn = null;
      selected = 0;
      cursor.hidden = true;
      rowMark.hidden = true;
      readout.textContent = '';
      heat.width = 0;
      matrix.width = 0;
      plots.forEach((plot) => plot!.replaceChildren());
      glyphs.replaceChildren();
      table.replaceChildren();
    },
  };
};
