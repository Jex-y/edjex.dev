import { OUTPUT_SIZE } from './network';

export type Detection = {
  readonly score: number;
  readonly row: number;
  readonly col: number;
  readonly y: number;
  readonly x: number;
};

const PLANE = OUTPUT_SIZE * OUTPUT_SIZE;

const sigmoid = (logit: number) => 1 / (1 + Math.exp(-logit));

export const heatmap = (output: Float32Array): Float32Array =>
  output.subarray(0, PLANE).map(sigmoid);

const isLocalMax = (scores: Float32Array, row: number, col: number) => {
  const score = scores[row * OUTPUT_SIZE + col];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const r = row + dy;
      const c = col + dx;
      if (r < 0 || r >= OUTPUT_SIZE || c < 0 || c >= OUTPUT_SIZE) continue;
      if (scores[r * OUTPUT_SIZE + c] > score) return false;
    }
  }
  return true;
};

export const decode = (
  output: Float32Array,
  scores: Float32Array,
  threshold: number,
): Detection[] =>
  Array.from(scores.entries())
    .filter(([, score]) => score > threshold)
    .map(([i, score]) => ({
      score,
      row: Math.floor(i / OUTPUT_SIZE),
      col: i % OUTPUT_SIZE,
    }))
    .filter(({ row, col }) => isLocalMax(scores, row, col))
    .map(({ score, row, col }) => {
      const i = row * OUTPUT_SIZE + col;
      return {
        score,
        row,
        col,
        y: row + output[PLANE + i],
        x: col + output[2 * PLANE + i],
      };
    });
