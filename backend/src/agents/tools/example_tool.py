"""Tool mẫu. Thêm tool mới = viết một hàm có @tool rồi đưa vào TOOLS ở tools/__init__.py."""

import ast
import operator
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from langchain_core.tools import tool

_SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}
_MAX_EXPRESSION_LENGTH = 200
_MAX_EXPONENT = 100


@tool
def get_current_time(timezone: str = "Asia/Ho_Chi_Minh") -> str:
    """Lấy ngày giờ hiện tại theo múi giờ IANA (ví dụ: "Asia/Ho_Chi_Minh", "UTC")."""
    try:
        now = datetime.now(ZoneInfo(timezone))
    except (ZoneInfoNotFoundError, ValueError):
        return f"Múi giờ không hợp lệ: {timezone}"
    return now.strftime("%Y-%m-%d %H:%M:%S %Z")


@tool
def calculate(expression: str) -> str:
    """Tính một biểu thức toán học. Hỗ trợ + - * / // % ** và dấu ngoặc. Ví dụ: "2 + 3 * 4"."""
    if len(expression) > _MAX_EXPRESSION_LENGTH:
        return "Lỗi tính toán: biểu thức quá dài"
    try:
        tree = ast.parse(expression, mode="eval")
        return str(_eval_node(tree.body))
    except (SyntaxError, ValueError, TypeError, ZeroDivisionError, OverflowError) as e:
        return f"Lỗi tính toán: {e}"


def _eval_node(node: ast.AST) -> float:
    """Tính đệ quy trên AST, chỉ cho phép số và các toán tử trong _SAFE_OPERATORS (không dùng eval)."""
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            return node.value
        raise ValueError(f"Kiểu giá trị không hỗ trợ: {type(node.value).__name__}")
    if isinstance(node, ast.UnaryOp):
        op_func = _SAFE_OPERATORS.get(type(node.op))
        if op_func is None:
            raise ValueError(f"Toán tử không hỗ trợ: {type(node.op).__name__}")
        return op_func(_eval_node(node.operand))
    if isinstance(node, ast.BinOp):
        op_func = _SAFE_OPERATORS.get(type(node.op))
        if op_func is None:
            raise ValueError(f"Toán tử không hỗ trợ: {type(node.op).__name__}")
        left, right = _eval_node(node.left), _eval_node(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > _MAX_EXPONENT:
            raise ValueError("Số mũ quá lớn")
        return op_func(left, right)
    raise ValueError(f"Biểu thức không hỗ trợ: {type(node).__name__}")
