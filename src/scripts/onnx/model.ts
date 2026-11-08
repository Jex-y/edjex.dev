import type { Tensor } from 'onnxruntime-web';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

export type TensorInput = {
  readonly [T in Tensor.Type]: {
    readonly type: T;
    readonly data: Tensor.DataTypeMap[T];
    readonly dims: readonly number[];
  };
}[Tensor.Type];

export type Feeds = Readonly<Record<string, TensorInput>>;
export type Outputs = Readonly<Record<string, Tensor>>;

export type Model = {
  readonly run: (feeds: Feeds) => Promise<Outputs>;
};

export const loadModel = async (url: string): Promise<Model> => {
  const ort = await import('onnxruntime-web/wasm');
  // A wasm path without an mjs path keeps the entry's embedded glue code, so
  // this file must come from the same build as the entry imported above.
  ort.env.wasm.wasmPaths = { wasm: wasmUrl };
  ort.env.wasm.numThreads = 1;

  const session = await ort.InferenceSession.create(url, {
    executionProviders: ['wasm'],
  });
  return {
    run: (feeds) =>
      session.run(
        Object.fromEntries(
          Object.entries(feeds).map(([name, { type, data, dims }]) => [
            name,
            new ort.Tensor(type, data, dims),
          ]),
        ),
      ),
  };
};
