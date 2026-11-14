from src.agents.tools.child_alert import notify_child
from src.agents.tools.example_tool import calculate, get_current_time

# Danh sách tool agent được phép gọi.
TOOLS = [calculate, get_current_time, notify_child]
