from langgraph.graph import StateGraph, END
from core.orchestrator.state import DevOSState
from core.orchestrator.nodes import orchestrator_node, developer_node, reviewer_node, human_node

def route_reviewer(state: DevOSState):
    """Route based on reviewer verdict"""
    if state.get("reviewer_verdict") == "APPROVED":
        return "human"
    
    # If error count is too high, escalate to human
    if state.get("error_count", 0) >= 3:
        return "human"
        
    return "developer"

def route_human(state: DevOSState):
    """Route based on human approval"""
    if state.get("human_approved"):
        return END
    return "developer"

def route_orchestrator(state: DevOSState):
    """Basic routing from orchestrator - for now, direct to developer"""
    return "developer"

def create_graph():
    workflow = StateGraph(DevOSState)
    
    # Add nodes
    workflow.add_node("orchestrator", orchestrator_node)
    workflow.add_node("developer", developer_node)
    workflow.add_node("reviewer", reviewer_node)
    workflow.add_node("human", human_node)
    
    # Set entry point
    workflow.set_entry_point("orchestrator")
    
    # Add edges
    workflow.add_conditional_edges(
        "orchestrator",
        route_orchestrator,
        {
            "developer": "developer"
        }
    )
    
    workflow.add_edge("developer", "reviewer")
    
    workflow.add_conditional_edges(
        "reviewer",
        route_reviewer,
        {
            "human": "human",
            "developer": "developer"
        }
    )
    
    workflow.add_conditional_edges(
        "human",
        route_human,
        {
            END: END,
            "developer": "developer"
        }
    )
    
    return workflow.compile()
