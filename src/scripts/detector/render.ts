import type { Detection } from './decode';
import { INPUT_SIZE, OUTPUT_STRIDE, toInput } from './network';

export type Rgb = readonly [number, number, number];
type Stop = readonly [number, Rgb];

export const INK = '#14243d';
export const CREAM = '#fff6d8';

const ramp =
  (stops: readonly Stop[]) =>
  (t: number): Rgb => {
    const clamped = Math.min(Math.max(t, 0), 1);
    const upper = Math.max(
      stops.findIndex(([stop]) => stop >= clamped),
      1,
    );
    const [s0, c0] = stops[upper - 1];
    const [s1, c1] = stops[upper];
    const f = (clamped - s0) / (s1 - s0);
    return [0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * f) as unknown as Rgb;
  };

export const sequential = ramp([
  [0, [20, 36, 61]],
  [0.3, [40, 90, 140]],
  [0.55, [60, 155, 176]],
  [0.8, [159, 224, 200]],
  [1, [255, 246, 216]],
]);

export const diverging = ramp([
  [0, [59, 111, 182]],
  [0.5, [244, 241, 234]],
  [1, [192, 83, 58]],
]);

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

export type ModelInput = {
  readonly input: Float32Array<ArrayBuffer>;
  readonly pixels: ImageData;
};

export const modelInput = (image: HTMLImageElement): ModelInput => {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('no 2d context');
  context.drawImage(image, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  return { input: toInput(pixels.data), pixels };
};

export const paintGrid = (
  canvas: HTMLCanvasElement,
  size: number,
  colourAt: (i: number) => Rgb,
) => {
  const context = canvas.getContext('2d');
  if (!context) return;
  const grid = new ImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = colourAt(i);
    grid.data.set([r, g, b, 255], i * 4);
  }
  const source = document.createElement('canvas');
  source.width = size;
  source.height = size;
  source.getContext('2d')?.putImageData(grid, 0, 0);
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
};

export type MarkerStyle = 'fired' | 'below' | 'hot';

export const drawMarker = (
  context: CanvasRenderingContext2D,
  detection: Detection,
  {
    size,
    style,
    cell,
    offset,
  }: { size: number; style: MarkerStyle; cell: boolean; offset: boolean },
) => {
  const scaleX = (context.canvas.width / INPUT_SIZE) * OUTPUT_STRIDE;
  const scaleY = (context.canvas.height / INPUT_SIZE) * OUTPUT_STRIDE;
  const cellX = (detection.col + 0.5) * scaleX;
  const cellY = (detection.row + 0.5) * scaleY;
  const half = size / 2;
  if (style === 'below') {
    context.setLineDash([3, 2]);
    context.strokeStyle = CREAM;
    context.lineWidth = 1.25;
    context.strokeRect(cellX - half, cellY - half, size, size);
    context.setLineDash([]);
    return;
  }
  const outline = style === 'hot' ? '#e07a1f' : INK;
  if (cell) {
    [
      [outline, size / 4],
      [CREAM, size / 9],
    ].forEach(([stroke, width]) => {
      context.strokeStyle = stroke as string;
      context.lineWidth = width as number;
      context.strokeRect(cellX - half, cellY - half, size, size);
    });
  }
  if (!offset) return;
  context.beginPath();
  context.arc(
    detection.x * scaleX,
    detection.y * scaleY,
    size / 6,
    0,
    Math.PI * 2,
  );
  context.fillStyle = CREAM;
  context.fill();
  context.lineWidth = size / 11;
  context.strokeStyle = INK;
  context.stroke();
};
