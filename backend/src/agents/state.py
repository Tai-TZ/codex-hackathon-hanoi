from langgraph.graph import MessagesState


class AgentState(MessagesState):
    """State của agent. `messages` (lịch sử hội thoại) có sẵn từ MessagesState.

    Thêm field riêng của sản phẩm ở đây, ví dụ:
        user_location: str
    """
