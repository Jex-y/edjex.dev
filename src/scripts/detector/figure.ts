import { loadBackends, preferred, type Backend } from './backend';
import { decode, heatmap, type Detection } from './decode';
import { OUTPUT_SIZE } from './network';
import {
  drawMarker,
  loadImage,
  modelInput,
  paintGrid,
  sequential,
} from './render';

type Result = {
  readonly image: HTMLImageElement;
  readonly scores: Float32Array;
  readonly detections: readonly Detection[];
  readonly milliseconds: number;
};

const THRESHOLD = 0.5;
const ADVANCE_MS = 4000;
const MARKER = 16;

const detect = async (
  backend: Backend,
  image: HTMLImageElement,
): Promise<Result> => {
  const { input } = modelInput(image);
  const start = performance.now();
  const output = await backend.run(input);
  const milliseconds = performance.now() - start;
  const scores = heatmap(output);
  return {
    image,
    scores,
    detections: decode(output, scores, THRESHOLD),
    milliseconds,
  };
};

const drawFrame = (canvas: HTMLCanvasElement, result: Result) => {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.drawImage(result.image, 0, 0, canvas.width, canvas.height);
  result.detections.forEach((detection) =>
    drawMarker(context, detection, {
      size: MARKER,
      style: 'fired',
      cell: true,
      offset: true,
    }),
  );
};

const describe = (backend: Backend, result: Result) => {
  const count = result.detections.length;
  const fleas = count === 1 ? '1 water flea' : `${count} water fleas`;
  const device = backend.name === 'WebGPU' ? 'your GPU' : 'your CPU';
  return `${fleas} · ${result.milliseconds.toFixed(1)} ms on ${device}`;
};

export const mountLiveDetector = (root: HTMLElement) => {
  const frameCanvas = root.querySelector<HTMLCanvasElement>('canvas.frame');
  const heatCanvas = root.querySelector<HTMLCanvasElement>('canvas.heat');
  const status = root.querySelector<HTMLElement>('.status');
  const button = root.querySelector<HTMLButtonElement>('button');
  const frames: string[] = JSON.parse(root.dataset.frames ?? '[]');
  const weightsUrl = root.dataset.weights;
  if (!frameCanvas || !heatCanvas || !status || !button || !weightsUrl) return;

  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  let backend: Promise<Backend> | null = null;
  let index = 0;
  let visible = false;
  let busy = false;
  let timer: number | undefined;

  const show = async (next: number) => {
    if (busy) return;
    busy = true;
    index = (next + frames.length) % frames.length;
    try {
      backend ??= loadBackends(weightsUrl).then(preferred);
      const ready = await backend;
      const result = await detect(ready, await loadImage(frames[index]));
      drawFrame(frameCanvas, result);
      paintGrid(heatCanvas, OUTPUT_SIZE, (i) =>
        sequential(Math.sqrt(result.scores[i])),
      );
      status.textContent = describe(ready, result);
      button.disabled = false;
    } catch {
      status.textContent = 'The model could not run in this browser.';
    } finally {
      busy = false;
    }
  };

  const schedule = () => {
    window.clearInterval(timer);
    timer =
      visible && !calm.matches
        ? window.setInterval(() => show(index + 1), ADVANCE_MS)
        : undefined;
  };

  button.addEventListener('click', () => {
    show(index + 1);
    schedule();
  });

  new IntersectionObserver(([entry]) => {
    const first = !visible && backend === null;
    visible = entry.isIntersecting;
    if (visible && first) show(0);
    schedule();
  }).observe(root);
  calm.addEventListener('change', schedule);
};
