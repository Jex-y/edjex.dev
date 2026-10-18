# /// script
# requires-python = ">=3.11"
# dependencies = ["onnx", "numpy"]
# ///
"""Flatten the thesis detector's ONNX weights into the float32 blob the site loads.

Usage: uv run scripts/export-detector-weights.py model.onnx src/assets/detector/keynas5-204.bin

The blob is each Conv's weight then bias, in graph order, little-endian float32.
src/scripts/detector/network.ts reads it back with the same layer shapes.
"""

import sys

import numpy as np
import onnx
from onnx import numpy_helper


def main(model_path: str, out_path: str) -> None:
    graph = onnx.load(model_path).graph
    initializers = {t.name: numpy_helper.to_array(t) for t in graph.initializer}
    convs = [node for node in graph.node if node.op_type == "Conv"]

    tensors = [
        initializers[name].astype("<f4").ravel()
        for node in convs
        for name in node.input[1:]
    ]
    for node in convs:
        weight = initializers[node.input[1]]
        stride = next(a.ints for a in node.attribute if a.name == "strides")
        print(f"conv {weight.shape} stride {list(stride)}")

    blob = np.concatenate(tensors)
    blob.tofile(out_path)
    print(f"{blob.size} floats -> {out_path}")


if __name__ == "__main__":
    main(*sys.argv[1:])
