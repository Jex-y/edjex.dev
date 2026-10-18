import { runOnCpu, traceOnCpu } from './cpu';
import { createGpuRunner, type Runner } from './gpu';
import { parseParameters } from './network';

export type Backend = Runner & { readonly name: 'WebGPU' | 'CPU' };
export type Backends = { readonly gpu: Backend | null; readonly cpu: Backend };

export const loadBackends = async (weightsUrl: string): Promise<Backends> => {
  const response = await fetch(weightsUrl);
  const parameters = parseParameters(await response.arrayBuffer());
  const gpu = await createGpuRunner(parameters).catch(() => null);
  return {
    gpu: gpu && { name: 'WebGPU', ...gpu },
    cpu: {
      name: 'CPU',
      run: async (input) => runOnCpu(parameters, input),
      trace: async (input) => traceOnCpu(parameters, input),
    },
  };
};

export const preferred = ({ gpu, cpu }: Backends): Backend => gpu ?? cpu;
