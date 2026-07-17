import os
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from core.orchestrator.state import DevOSState

# Load LLM
def get_llm():
    # Use Gemini by default as it's typically available in this environment
    return ChatGoogleGenerativeAI(model="gemini-2.5-pro", temperature=0)

def load_prompt(agent_name: str) -> str:
    path = os.path.join(".agents", "agents", f"{agent_name}.md")
    if os.path.exists(path):
        with open(path, "r") as f:
            return f.read()
    return f"You are the {agent_name} agent."

def orchestrator_node(state: DevOSState):
    llm = get_llm()
    system_prompt = load_prompt("orchestrator")
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    
    # If starting fresh, pass the task description
    if not state.get("messages"):
        messages.append(HumanMessage(content=f"Task: {state['task_description']}"))
        
    response = llm.invoke(messages)
    return {"messages": [response], "current_agent": "orchestrator"}

def developer_node(state: DevOSState):
    llm = get_llm()
    system_prompt = load_prompt("developer")
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    
    response = llm.invoke(messages)
    return {"messages": [response], "current_agent": "developer"}

def reviewer_node(state: DevOSState):
    llm = get_llm()
    system_prompt = load_prompt("reviewer")
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    
    response = llm.invoke(messages)
    
    # Parse verdict from response (simplified logic)
    verdict = "APPROVED" if "APPROVED" in response.content else "CHANGES REQUESTED"
    
    return {
        "messages": [response], 
        "current_agent": "reviewer",
        "reviewer_verdict": verdict,
        "error_count": state.get("error_count", 0) + (1 if verdict != "APPROVED" else 0)
    }

def human_node(state: DevOSState):
    """
    This node prompts the human for approval in the terminal.
    """
    print("\n--- HUMAN CHECKPOINT ---")
    print(state["messages"][-1].content)
    approval = input("\nDo you approve these changes for commit? (y/n): ")
    
    is_approved = approval.lower().startswith('y')
    response_msg = HumanMessage(content="Human approved the changes." if is_approved else "Human rejected the changes. Provide feedback.")
    
    return {
        "messages": [response_msg],
        "current_agent": "human",
        "human_approved": is_approved
    }
