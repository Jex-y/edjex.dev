import { loadModel, type Model } from '../onnx/model';
import { mountCharacterChart } from './chart';
import { createLineEditor, spansOf } from './editor';
import { encodeText } from './encoding';
import { drawLine, SAMPLE_LINE, type LineLayout, type Span } from './line';
import {
  attentionMap,
  characterReadings,
  characterStyles,
  codepoints,
  MAX_CHARACTERS,
  modelFeeds,
  styledRuns,
  type StyledRun,
} from './preprocessing';

const runElement = ({ text, strike, underline }: StyledRun): Node => {
  const content = document.createTextNode(text);
  const wrap = (tag: 's' | 'u', child: Node) => {
    const element = document.createElement(tag);
    element.append(child);
    return element;
  };
  const inner = underline ? wrap('u', content) : content;
  return strike ? wrap('s', inner) : inner;
};

export const mountLiveStrikethrough = (root: HTMLElement) => {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas.raster');
  const context = canvas?.getContext('2d', { willReadFrequently: true });
  const editorElement = root.querySelector<HTMLElement>('.editor');
  const count = root.querySelector<HTMLElement>('.count');
  const prediction = root.querySelector<HTMLElement>('.prediction');
  const status = root.querySelector<HTMLElement>('.status');
  const strikeButton = root.querySelector<HTMLButtonElement>(
    'button[data-mark="strike"]',
  );
  const underlineButton = root.querySelector<HTMLButtonElement>(
    'button[data-mark="underline"]',
  );
  const chart = mountCharacterChart(root);
  const modelUrl = root.dataset.model;
  if (
    !canvas ||
    !context ||
    !editorElement ||
    !count ||
    !prediction ||
    !status ||
    !strikeButton ||
    !underlineButton ||
    !chart ||
    !modelUrl
  ) {
    return;
  }

  const editor = createLineEditor(editorElement, SAMPLE_LINE);
  const redraw = (spans: readonly Span[]): LineLayout => {
    const drawn = drawLine(canvas, context, spans);
    root.style.setProperty('--line-width', String(drawn.width));
    return drawn;
  };

  let layout = redraw(SAMPLE_LINE);
  let model: Promise<Model> | null = null;
  let caret: number | null = null;

  const clearOutputs = () => {
    chart.clear();
    prediction.replaceChildren();
  };

  const show = async () => {
    try {
      model ??= loadModel(modelUrl);
      const ready = await model;
      const current = layout;
      const characters = codepoints(current.text);
      if (characters.length === 0) {
        clearOutputs();
        status.textContent = 'Type a line for the model to read.';
        return;
      }
      const raster = context.getImageData(0, 0, canvas.width, canvas.height);
      const feeds = modelFeeds(
        raster,
        encodeText(characters),
        characters.length,
      );
      const start = performance.now();
      const outputs = await ready.run(feeds);
      const milliseconds = performance.now() - start;
      const readings = characterReadings(outputs);
      chart.render(current, readings, attentionMap(outputs, current.width));
      if (caret !== null) chart.focus(caret);
      caret = null;
      prediction.replaceChildren(
        ...styledRuns(characters, characterStyles(readings)).map(runElement),
      );
      status.textContent = `${milliseconds.toFixed(1)} ms on your CPU`;
    } catch (error) {
      clearOutputs();
      status.textContent =
        error instanceof RangeError
          ? 'This line is too wide for the model. Try a shorter one.'
          : 'The model could not run in this browser.';
    }
  };

  // Runs on one session must not overlap, and only the latest line matters.
  let running = false;
  let stale = false;
  const update = async () => {
    stale = true;
    if (running) return;
    running = true;
    while (stale) {
      stale = false;
      await show();
    }
    running = false;
  };

  const syncToolbar = () => {
    strikeButton.setAttribute(
      'aria-pressed',
      String(editor.isActive('strike')),
    );
    underlineButton.setAttribute(
      'aria-pressed',
      String(editor.isActive('underline')),
    );
    count.textContent = `${codepoints(editor.getText()).length} / ${MAX_CHARACTERS}`;
  };

  editor.on('transaction', ({ transaction }) => {
    syncToolbar();
    if (!transaction.docChanged) return;
    const { doc, selection } = editor.state;
    layout = redraw(spansOf(doc));
    caret = codepoints(doc.textBetween(0, selection.from)).length - 1;
    void update();
  });

  strikeButton.addEventListener('click', () =>
    editor.chain().focus().toggleStrike().run(),
  );
  underlineButton.addEventListener('click', () =>
    editor.chain().focus().toggleUnderline().run(),
  );
  [strikeButton, underlineButton].forEach((button) => {
    // Keeps the caret in the editor, so typing can continue straight after a click.
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.disabled = false;
  });
  syncToolbar();

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    void update();
  });
  observer.observe(root);
};
