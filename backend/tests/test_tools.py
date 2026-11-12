import pytest

from src.agents.tools.example_tool import calculate, get_current_time


@pytest.mark.parametrize(
    ("expression", "expected"),
    [("2 + 3 * 4", "14"), ("(1 + 2) ** 2", "9"), ("-7 // 2", "-4"), ("10 / 4", "2.5")],
)
def test_calculate_evaluates_arithmetic(expression, expected):
    assert calculate.invoke({"expression": expression}) == expected


@pytest.mark.parametrize(
    "expression",
    ["__import__('os').system('ls')", "1 / 0", "2 ** 100000", "'a' * 3", "x + 1", "1 +" * 200],
)
def test_calculate_rejects_unsafe_or_invalid_input(expression):
    assert calculate.invoke({"expression": expression}).startswith("Lỗi tính toán")


def test_get_current_time_uses_requested_timezone():
    assert get_current_time.invoke({"timezone": "UTC"}).endswith("UTC")


def test_get_current_time_reports_unknown_timezone():
    assert "không hợp lệ" in get_current_time.invoke({"timezone": "Mars/Olympus"})
