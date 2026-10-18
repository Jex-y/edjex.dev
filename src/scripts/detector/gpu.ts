/// <reference types="@webgpu/types" />
import { LAYERS, type Parameters } from './network';

export type Runner = {
  readonly run: (input: Float32Array<ArrayBuffer>) => Promise<Float32Array>;
  readonly trace: (
    input: Float32Array<ArrayBuffer>,
  ) => Promise<readonly Float32Array[]>;
};

const WORKGROUP = 64;

const SHADER = /* wgsl */ `
struct Layer {
  in_channels: u32,
  out_channels: u32,
  in_size: u32,
  out_size: u32,
  stride: u32,
  relu: u32,
  weight_offset: u32,
  bias_offset: u32,
}

@group(0) @binding(0) var<uniform> layer: Layer;
@group(0) @binding(1) var<storage, read> parameters: array<f32>;
@group(0) @binding(2) var<storage, read> inputs: array<f32>;
@group(0) @binding(3) var<storage, read_write> outputs: array<f32>;

@compute @workgroup_size(${WORKGROUP})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let plane = layer.out_size * layer.out_size;
  if (id.x >= layer.out_channels * plane) {
    return;
  }
  let oc = id.x / plane;
  let oy = (id.x % plane) / layer.out_size;
  let ox = id.x % layer.out_size;
  let size = i32(layer.in_size);
  var sum = parameters[layer.bias_offset + oc];
  for (var ic = 0u; ic < layer.in_channels; ic++) {
    let kernel = layer.weight_offset + (oc * layer.in_channels + ic) * 9u;
    let channel = ic * layer.in_size * layer.in_size;
    for (var ky = 0u; ky < 3u; ky++) {
      let iy = i32(oy * layer.stride + ky) - 1;
      if (iy < 0 || iy >= size) {
        continue;
      }
      for (var kx = 0u; kx < 3u; kx++) {
        let ix = i32(ox * layer.stride + kx) - 1;
        if (ix < 0 || ix >= size) {
          continue;
        }
        sum += parameters[kernel + ky * 3u + kx]
          * inputs[channel + u32(iy) * layer.in_size + u32(ix)];
      }
    }
  }
  if (layer.relu == 1u) {
    sum = max(sum, 0.0);
  }
  outputs[id.x] = sum;
}
`;

const storage = (device: GPUDevice, floats: number, usage = 0) =>
  device.createBuffer({
    size: floats * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | usage,
  });

export const createGpuRunner = async (
  parameters: Parameters,
): Promise<Runner | null> => {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) return null;

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({ code: SHADER }),
      entryPoint: 'main',
    },
  });

  const parameterBuffer = storage(device, parameters.length);
  device.queue.writeBuffer(parameterBuffer, 0, parameters);

  const first = LAYERS[0];
  const activations = [
    storage(device, first.inChannels * first.inSize * first.inSize),
    ...LAYERS.map((layer, i) =>
      storage(
        device,
        layer.outChannels * layer.outSize * layer.outSize,
        GPUBufferUsage.COPY_SRC,
      ),
    ),
  ];
  const outputs = activations.slice(1);
  const readbacks = outputs.map((buffer) =>
    device.createBuffer({
      size: buffer.size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    }),
  );

  const passes = LAYERS.map((layer, i) => {
    const uniforms = device.createBuffer({
      size: 8 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      uniforms,
      0,
      new Uint32Array([
        layer.inChannels,
        layer.outChannels,
        layer.inSize,
        layer.outSize,
        layer.stride,
        layer.relu ? 1 : 0,
        layer.weightOffset,
        layer.biasOffset,
      ]),
    );
    return {
      workgroups: Math.ceil(
        (layer.outChannels * layer.outSize * layer.outSize) / WORKGROUP,
      ),
      bindGroup: device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniforms } },
          { binding: 1, resource: { buffer: parameterBuffer } },
          { binding: 2, resource: { buffer: activations[i] } },
          { binding: 3, resource: { buffer: activations[i + 1] } },
        ],
      }),
    };
  });

  const execute = async (
    input: Float32Array<ArrayBuffer>,
    layers: readonly number[],
  ) => {
    device.queue.writeBuffer(activations[0], 0, input);
    const encoder = device.createCommandEncoder();
    passes.forEach(({ bindGroup, workgroups }) => {
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(workgroups);
      pass.end();
    });
    layers.forEach((i) =>
      encoder.copyBufferToBuffer(
        outputs[i],
        0,
        readbacks[i],
        0,
        outputs[i].size,
      ),
    );
    device.queue.submit([encoder.finish()]);
    return Promise.all(
      layers.map(async (i) => {
        await readbacks[i].mapAsync(GPUMapMode.READ);
        const result = new Float32Array(readbacks[i].getMappedRange().slice(0));
        readbacks[i].unmap();
        return result;
      }),
    );
  };

  return {
    run: async (input) => (await execute(input, [LAYERS.length - 1]))[0],
    trace: (input) =>
      execute(
        input,
        LAYERS.map((_, i) => i),
      ),
  };
};
