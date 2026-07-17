from typing import TypedDict, Annotated, Sequence
import operator
from langchain_core.messages import BaseMessage

class DevOSState(TypedDict):
    """
    State for the Dev-OS orchestration graph.
    """
    messages: Annotated[Sequence[BaseMessage], operator.add]
    task_description: str
    current_agent: str
    reviewer_verdict: str  # "APPROVED" or "CHANGES REQUESTED"
    human_approved: bool   # True if human approves commit
    error_count: int       # Track loops to avoid infinite loops
