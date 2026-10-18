import { LAYERS, type Layer, type Parameters } from './network';

const conv = (
  layer: Layer,
  parameters: Parameters,
  input: Float32Array,
): Float32Array => {
  const { inChannels, outChannels, inSize, outSize, stride, relu } = layer;
  const output = new Float32Array(outChannels * outSize * outSize);
  for (let oc = 0; oc < outChannels; oc++) {
    const bias = parameters[layer.biasOffset + oc];
    for (let oy = 0; oy < outSize; oy++) {
      for (let ox = 0; ox < outSize; ox++) {
        let sum = bias;
        for (let ic = 0; ic < inChannels; ic++) {
          const kernel = layer.weightOffset + (oc * inChannels + ic) * 9;
          const plane = ic * inSize * inSize;
          for (let ky = 0; ky < 3; ky++) {
            const iy = oy * stride + ky - 1;
            if (iy < 0 || iy >= inSize) continue;
            for (let kx = 0; kx < 3; kx++) {
              const ix = ox * stride + kx - 1;
              if (ix < 0 || ix >= inSize) continue;
              sum +=
                parameters[kernel + ky * 3 + kx] *
                input[plane + iy * inSize + ix];
            }
          }
        }
        output[(oc * outSize + oy) * outSize + ox] = relu
          ? Math.max(sum, 0)
          : sum;
      }
    }
  }
  return output;
};

export const runOnCpu = (
  parameters: Parameters,
  input: Float32Array,
): Float32Array =>
  LAYERS.reduce(
    (activations, layer) => conv(layer, parameters, activations),
    input,
  );
