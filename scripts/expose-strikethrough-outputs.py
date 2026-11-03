# /// script
# requires-python = ">=3.11"
# dependencies = ["onnx"]
# ///
"""Add the outputs LiveStrikethrough draws to a freshly exported strikethrough model.

Usage: uv run scripts/expose-strikethrough-outputs.py export.onnx src/assets/strikethrough/hybrid-int8.onnx

src/scripts/strikethrough/preprocessing.ts reads these by name.
"""

import sys

import onnx
from onnx import TensorProto, helper

OUTPUTS = (
    (
        "attention",
        "/net/blocks.1/attention/Softmax_output_0",
        ["batch", 4, "characters", "tokens"],
    ),
    ("logits", "/net/style/Add_output_0", ["batch", "characters", 2]),
)


def main(model_path: str, out_path: str) -> None:
    model = onnx.load(model_path)
    for name, source, shape in OUTPUTS:
        model.graph.node.append(
            helper.make_node("Identity", [source], [name], name=f"expose_{name}")
        )
        model.graph.output.append(
            helper.make_tensor_value_info(name, TensorProto.FLOAT, shape)
        )
    onnx.checker.check_model(model)
    onnx.save(model, out_path)
    print([output.name for output in model.graph.output], "->", out_path)


if __name__ == "__main__":
    main(*sys.argv[1:])
