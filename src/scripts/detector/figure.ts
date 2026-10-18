import { runOnCpu } from './cpu';
import { decode, heatmap, type Detection } from './decode';
import { createGpuRunner, type Runner } from './gpu';
import {
  INPUT_SIZE,
  OUTPUT_SIZE,
  OUTPUT_STRIDE,
  parseParameters,
  toInput,
} from './network';

type Backend = { readonly name: 'WebGPU' | 'CPU'; readonly run: Runner };
type Rgb = readonly [number, number, number];

type Result = {
  readonly image: HTMLImageElement;
  readonly scores: Float32Array;
  readonly detections: readonly Detection[];
  readonly milliseconds: number;
};

const THRESHOLD = 0.5;
const ADVANCE_MS = 4000;
const MARKER = 16;
const CREAM = '#fff6d8';
const NAVY = '#14243d';
const RAMP: readonly (readonly [number, Rgb])[] = [
  [0, [20, 36, 61]],
  [0.3, [40, 90, 140]],
  [0.55, [60, 155, 176]],
  [0.8, [159, 224, 200]],
  [1, [255, 246, 216]],
];

const colour = (t: number): Rgb => {
  const upper = RAMP.findIndex(([stop]) => stop >= t);
  if (upper <= 0) return RAMP[0][1];
  const [s0, c0] = RAMP[upper - 1];
  const [s1, c1] = RAMP[upper];
  const f = (t - s0) / (s1 - s0);
  return [0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * f) as unknown as Rgb;
};

const loadBackend = async (weightsUrl: string): Promise<Backend> => {
  const response = await fetch(weightsUrl);
  const parameters = parseParameters(await response.arrayBuffer());
  const gpu = await createGpuRunner(parameters).catch(() => null);
  return gpu
    ? { name: 'WebGPU', run: gpu }
    : { name: 'CPU', run: async (input) => runOnCpu(parameters, input) };
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const modelInput = (image: HTMLImageElement): Float32Array<ArrayBuffer> => {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('no 2d context');
  context.drawImage(image, 0, 0, INPUT_SIZE, INPUT_SIZE);
  return toInput(context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data);
};

const detect = async (
  backend: Backend,
  image: HTMLImageElement,
): Promise<Result> => {
  const input = modelInput(image);
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

const drawMarker = (
  context: CanvasRenderingContext2D,
  detection: Detection,
  scaleX: number,
  scaleY: number,
) => {
  const cellX = (detection.col + 0.5) * OUTPUT_STRIDE * scaleX;
  const cellY = (detection.row + 0.5) * OUTPUT_STRIDE * scaleY;
  const pointX = detection.x * OUTPUT_STRIDE * scaleX;
  const pointY = detection.y * OUTPUT_STRIDE * scaleY;
  const half = MARKER / 2;
  [
    [NAVY, 3.5],
    [CREAM, 1.5],
  ].forEach(([style, width]) => {
    context.strokeStyle = style as string;
    context.lineWidth = width as number;
    context.strokeRect(cellX - half, cellY - half, MARKER, MARKER);
  });
  context.beginPath();
  context.arc(pointX, pointY, 2.5, 0, Math.PI * 2);
  context.fillStyle = CREAM;
  context.fill();
  context.lineWidth = 1.5;
  context.strokeStyle = NAVY;
  context.stroke();
};

const drawFrame = (canvas: HTMLCanvasElement, result: Result) => {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.drawImage(result.image, 0, 0, canvas.width, canvas.height);
  const scaleX = canvas.width / INPUT_SIZE;
  const scaleY = canvas.height / INPUT_SIZE;
  result.detections.forEach((d) => drawMarker(context, d, scaleX, scaleY));
};

const drawHeatmap = (canvas: HTMLCanvasElement, scores: Float32Array) => {
  const context = canvas.getContext('2d');
  if (!context) return;
  const pixels = context.createImageData(OUTPUT_SIZE, OUTPUT_SIZE);
  scores.forEach((score, i) => {
    const [r, g, b] = colour(Math.sqrt(score));
    pixels.data.set([r, g, b, 255], i * 4);
  });
  context.putImageData(pixels, 0, 0);
};

const describe = (backend: Backend, result: Result) => {
  const count = result.detections.length;
  const fleas = count === 1 ? '1 water flea' : `${count} water fleas`;
  return `${fleas} · ${result.milliseconds.toFixed(1)} ms on ${backend.name === 'WebGPU' ? 'your GPU' : 'your CPU'}`;
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
      backend ??= loadBackend(weightsUrl);
      const ready = await backend;
      const result = await detect(ready, await loadImage(frames[index]));
      drawFrame(frameCanvas, result);
      drawHeatmap(heatCanvas, result.scores);
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
