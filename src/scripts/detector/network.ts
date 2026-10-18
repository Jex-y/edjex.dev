export const INPUT_SIZE = 192;
export const OUTPUT_SIZE = 96;
export const OUTPUT_STRIDE = INPUT_SIZE / OUTPUT_SIZE;
export const OUTPUT_CHANNELS = 3;
const KERNEL = 3;

export type Layer = {
  readonly inChannels: number;
  readonly outChannels: number;
  readonly inSize: number;
  readonly outSize: number;
  readonly stride: number;
  readonly relu: boolean;
  readonly weightOffset: number;
  readonly biasOffset: number;
};

const SPECS = [
  { inChannels: 3, outChannels: 48, stride: 2, relu: true },
  { inChannels: 48, outChannels: 24, stride: 1, relu: true },
  { inChannels: 24, outChannels: OUTPUT_CHANNELS, stride: 1, relu: false },
] as const;

export const LAYERS: readonly Layer[] = SPECS.reduce<Layer[]>(
  (layers, spec) => {
    const previous = layers.at(-1);
    const inSize = previous ? previous.outSize : INPUT_SIZE;
    const weightOffset = previous
      ? previous.biasOffset + previous.outChannels
      : 0;
    const weightCount = spec.outChannels * spec.inChannels * KERNEL * KERNEL;
    return [
      ...layers,
      {
        ...spec,
        inSize,
        outSize: Math.ceil(inSize / spec.stride),
        weightOffset,
        biasOffset: weightOffset + weightCount,
      },
    ];
  },
  [],
);

const last = LAYERS[LAYERS.length - 1];
const PARAMETER_COUNT = last.biasOffset + last.outChannels;

export type Parameters = Float32Array<ArrayBuffer> & {
  readonly __brand: 'Parameters';
};

export const parseParameters = (buffer: ArrayBuffer): Parameters => {
  const parameters = new Float32Array(buffer);
  if (parameters.length !== PARAMETER_COUNT) {
    throw new Error(
      `expected ${PARAMETER_COUNT} parameters, got ${parameters.length}`,
    );
  }
  return parameters as Parameters;
};

export const toInput = (rgba: Uint8ClampedArray): Float32Array<ArrayBuffer> => {
  const plane = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      input[c * plane + i] = (rgba[i * 4 + c] / 255 - 0.5) / 0.5;
    }
  }
  return input;
};
