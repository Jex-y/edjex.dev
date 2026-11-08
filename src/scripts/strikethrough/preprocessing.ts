import type { Feeds, Outputs } from '../onnx/model';
import type { EncodedText } from './encoding';

export const IMAGE_HEIGHT = 64;
const MAX_IMAGE_WIDTH = 4096;
export const MAX_CHARACTERS = 160;
const WIDTH_STEP = 4;
const CANVAS_STEP = 64;
export const THRESHOLD = 0.5;
const TOKEN_ROWS = 4;
export const TOKEN_WIDTH = 4;

/** RGBA rows, as in `ImageData`. */
export type Raster = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
};

export type CharacterReading = {
  readonly strike: number;
  readonly underline: number;
  readonly strikeLogit: number;
  readonly underlineLogit: number;
};

/** Each character's attention over the image tokens, averaged across heads. */
export type AttentionMap = {
  readonly characters: number;
  readonly rows: number;
  /** Tokens per row, including those over the padding of the batch canvas. */
  readonly columns: number;
  /** Tokens per row that cover the line. */
  readonly validColumns: number;
  /** Flattened from `[characters, rows, columns]`. */
  readonly weights: Float32Array;
};

export type CharacterStyle = {
  readonly strike: boolean;
  readonly underline: boolean;
};

export type StyledRun = CharacterStyle & { readonly text: string };

const roundUp = (value: number, step: number) => Math.ceil(value / step) * step;

const luma = (red: number, green: number, blue: number) =>
  (red * 19595 + green * 38470 + blue * 7471 + 0x8000) >> 16;

const inkImage = ({ width, height, data }: Raster, canvasWidth: number) => {
  const image = new Float32Array(height * canvasWidth);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * 4;
      image[y * canvasWidth + x] =
        (255 - luma(data[pixel], data[pixel + 1], data[pixel + 2])) / 255;
    }
  }
  return image;
};

export const codepoints = (text: string): readonly string[] => Array.from(text);

/** A batch of one, so `char_bytes` never needs padding. */
export const modelFeeds = (
  raster: Raster,
  encoded: EncodedText,
  characters: number,
): Feeds => {
  if (
    raster.height !== IMAGE_HEIGHT ||
    raster.width < 1 ||
    raster.width > MAX_IMAGE_WIDTH ||
    characters < 1 ||
    characters > MAX_CHARACTERS
  ) {
    throw new RangeError('The line is outside the limits of the model.');
  }
  const validWidth = roundUp(raster.width, WIDTH_STEP);
  const canvasWidth = roundUp(validWidth, CANVAS_STEP);
  return {
    images: {
      type: 'float32',
      data: inkImage(raster, canvasWidth),
      dims: [1, 1, IMAGE_HEIGHT, canvasWidth],
    },
    widths: {
      type: 'int64',
      data: BigInt64Array.of(BigInt(validWidth)),
      dims: [1],
    },
    char_bytes: {
      type: 'int64',
      data: encoded.bytes,
      dims: [1, characters, 4],
    },
    char_hashes: {
      type: 'int64',
      data: encoded.hashes,
      dims: [1, characters],
    },
    lengths: {
      type: 'int64',
      data: BigInt64Array.of(BigInt(characters)),
      dims: [1],
    },
  };
};

const float32Output = (outputs: Outputs, name: string): Float32Array => {
  const { data } = outputs[name];
  if (!(data instanceof Float32Array)) {
    throw new TypeError(`Expected float32 ${name}.`);
  }
  return data;
};

/** `probabilities` and `logits` are `[batch, characters, 2]`, ordered strike then underline. */
export const characterReadings = (
  outputs: Outputs,
): readonly CharacterReading[] => {
  const probabilities = float32Output(outputs, 'probabilities');
  const logits = float32Output(outputs, 'logits');
  return Array.from({ length: probabilities.length / 2 }, (_, index) => ({
    strike: probabilities[index * 2],
    underline: probabilities[index * 2 + 1],
    strikeLogit: logits[index * 2],
    underlineLogit: logits[index * 2 + 1],
  }));
};

/** `attention` is `[batch, heads, characters, tokens]`, with tokens in row order. */
export const attentionMap = (
  outputs: Outputs,
  lineWidth: number,
): AttentionMap => {
  const data = float32Output(outputs, 'attention');
  const [, heads, characters, tokens] = outputs.attention.dims;
  const size = characters * tokens;
  const weights = new Float32Array(size);
  for (let head = 0; head < heads; head++) {
    for (let index = 0; index < size; index++) {
      weights[index] += data[head * size + index] / heads;
    }
  }
  return {
    characters,
    rows: TOKEN_ROWS,
    columns: tokens / TOKEN_ROWS,
    validColumns: roundUp(lineWidth, WIDTH_STEP) / TOKEN_WIDTH,
    weights,
  };
};

export const characterStyles = (
  readings: readonly CharacterReading[],
): readonly CharacterStyle[] =>
  readings.map(({ strike, underline }) => ({
    strike: strike >= THRESHOLD,
    underline: underline >= THRESHOLD,
  }));

export const styledRuns = (
  characters: readonly string[],
  styles: readonly CharacterStyle[],
): readonly StyledRun[] =>
  characters.reduce<readonly StyledRun[]>((runs, text, index) => {
    const { strike, underline } = styles[index];
    const last = runs.at(-1);
    return last && last.strike === strike && last.underline === underline
      ? [...runs.slice(0, -1), { ...last, text: last.text + text }]
      : [...runs, { text, strike, underline }];
  }, []);
