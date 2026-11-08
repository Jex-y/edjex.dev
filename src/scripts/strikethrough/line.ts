import { codepoints, IMAGE_HEIGHT } from './preprocessing';

export type Span = {
  readonly text: string;
  readonly strike: boolean;
  readonly underline: boolean;
};

type Segment = Span & { readonly x: number; readonly width: number };

export type CharacterBox = {
  readonly character: string;
  readonly x: number;
  readonly width: number;
};

export type LineLayout = {
  readonly width: number;
  readonly text: string;
  readonly segments: readonly Segment[];
  readonly characters: readonly CharacterBox[];
};

export const SAMPLE_LINE: readonly Span[] = [
  { text: 'a sensor on the frame ', strike: false, underline: false },
  { text: 'configured to detect ', strike: true, underline: false },
  { text: 'a position of the arm', strike: false, underline: true },
];

// The crop has margins of 0.15 and 0.35 box heights around a box of height
// 64 / 1.7, which the font and baseline below are sized to fill.
const BOX_HEIGHT = IMAGE_HEIGHT / 1.7;
const MARGIN_X = Math.round(0.15 * BOX_HEIGHT);
export const FONT_SIZE = Math.round(BOX_HEIGHT);
const BASELINE = 42;
export const STROKE = 2;
export const STRIKE_Y = BASELINE - Math.round(FONT_SIZE * 0.25);
export const UNDERLINE_Y = BASELINE + 3;

export const FONT = `${FONT_SIZE}px "Times New Roman", Times, serif`;

export const layoutLine = (
  spans: readonly Span[],
  measure: (text: string) => number,
): LineLayout => {
  const text = spans.map((span) => span.text).join('');
  const starts = spans.map((_, index) =>
    measure(
      spans
        .slice(0, index)
        .map((span) => span.text)
        .join(''),
    ),
  );
  const total = measure(text);
  const characters = codepoints(text);
  const characterStarts = characters.map((_, index) =>
    measure(characters.slice(0, index).join('')),
  );
  return {
    width: Math.ceil(total) + 2 * MARGIN_X,
    text,
    segments: spans.map((span, index) => ({
      ...span,
      x: MARGIN_X + starts[index],
      width: (starts[index + 1] ?? total) - starts[index],
    })),
    characters: characters.map((character, index) => ({
      character,
      x: MARGIN_X + characterStarts[index],
      width: (characterStarts[index + 1] ?? total) - characterStarts[index],
    })),
  };
};

export const characterAt = ({ characters }: LineLayout, x: number): number => {
  const index = characters.findIndex((box) => x < box.x + box.width);
  return index === -1 ? characters.length - 1 : index;
};

export const drawLine = (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  spans: readonly Span[],
): LineLayout => {
  context.font = FONT;
  const layout = layoutLine(spans, (text) => context.measureText(text).width);
  canvas.width = layout.width;
  canvas.height = IMAGE_HEIGHT;
  // Resizing a canvas resets its context state.
  context.font = FONT;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000';
  context.fillText(layout.text, MARGIN_X, BASELINE);
  layout.segments.forEach(({ x, width, strike, underline }) => {
    if (strike) context.fillRect(x, STRIKE_Y, width, STROKE);
    if (underline) context.fillRect(x, UNDERLINE_Y, width, STROKE);
  });
  return layout;
};
