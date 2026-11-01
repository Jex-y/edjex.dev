import type { Feeds, Outputs } from '../onnx/model';
import type { EncodedText } from './encoding';

export const IMAGE_HEIGHT = 64;
const MAX_IMAGE_WIDTH = 4096;
const MAX_CHARACTERS = 160;
const WIDTH_STEP = 4;
const CANVAS_STEP = 64;
const THRESHOLD = 0.5;

/** RGBA rows, as in `ImageData`. */
export type Raster = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
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

/** `probabilities` is `[batch, characters, 2]`, ordered strike then underline. */
export const characterStyles = (
  outputs: Outputs,
): readonly CharacterStyle[] => {
  const { data } = outputs.probabilities;
  if (!(data instanceof Float32Array)) {
    throw new TypeError('Expected float32 probabilities.');
  }
  return Array.from({ length: data.length / 2 }, (_, index) => ({
    strike: data[index * 2] >= THRESHOLD,
    underline: data[index * 2 + 1] >= THRESHOLD,
  }));
};

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
