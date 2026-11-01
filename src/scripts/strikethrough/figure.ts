import { loadModel, type Model } from '../onnx/model';
import { encodeText } from './encoding';
import { drawLine, SAMPLE_LINE, toggled, type Mark, type Span } from './line';
import {
  characterStyles,
  codepoints,
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
  const canvas = root.querySelector('canvas');
  const context = canvas?.getContext('2d', { willReadFrequently: true });
  const prediction = root.querySelector<HTMLElement>('.prediction');
  const status = root.querySelector<HTMLElement>('.status');
  const buttons = Array.from(root.querySelectorAll('button'));
  const modelUrl = root.dataset.model;
  if (!canvas || !context || !prediction || !status || !modelUrl) return;

  let spans: readonly Span[] = SAMPLE_LINE;
  let model: Promise<Model> | null = null;
  let pending: Promise<void> = Promise.resolve();

  const show = async () => {
    try {
      model ??= loadModel(modelUrl);
      const ready = await model;
      const characters = codepoints(spans.map(({ text }) => text).join(''));
      const raster = context.getImageData(0, 0, canvas.width, canvas.height);
      const feeds = modelFeeds(
        raster,
        encodeText(characters),
        characters.length,
      );
      const start = performance.now();
      const outputs = await ready.run(feeds);
      const milliseconds = performance.now() - start;
      prediction.replaceChildren(
        ...styledRuns(characters, characterStyles(outputs)).map(runElement),
      );
      status.textContent = `${milliseconds.toFixed(1)} ms on your CPU`;
      buttons.forEach((button) => (button.disabled = false));
    } catch {
      status.textContent = 'The model could not run in this browser.';
    }
  };

  // Runs on one session must not overlap.
  const update = () => {
    pending = pending.then(show);
  };

  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      const pressed = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(pressed));
      spans = toggled(
        spans,
        Number(button.dataset.span),
        button.dataset.mark as Mark,
      );
      drawLine(canvas, context, spans);
      update();
    }),
  );

  drawLine(canvas, context, spans);

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    update();
  });
  observer.observe(root);
};
