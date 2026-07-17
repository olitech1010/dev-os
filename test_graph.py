from langchain_core.messages import AIMessage
from unittest.mock import patch
from core.orchestrator.graph import create_graph

class MockLLM:
    def invoke(self, messages):
        return AIMessage(content="Mocked LLM Response")

def test():
    print("Testing Graph...")
    
    with patch('core.orchestrator.nodes.get_llm', return_value=MockLLM()):
        # We'll also mock the human_node to avoid waiting for input
        with patch('core.orchestrator.nodes.human_node') as mock_human:
            mock_human.return_value = {
                "messages": [AIMessage(content="Human approved")],
                "current_agent": "human",
                "human_approved": True
            }
            
            # To test the looping logic, let's also mock reviewer to loop once then approve
            call_count = [0]
            
            def side_effect_reviewer(state):
                call_count[0] += 1
                if call_count[0] < 2:
                    verdict = "CHANGES REQUESTED"
                else:
                    verdict = "APPROVED"
                
                return {
                    "messages": [AIMessage(content=f"Reviewer output: {verdict}")],
                    "current_agent": "reviewer",
                    "reviewer_verdict": verdict,
                    "error_count": state.get("error_count", 0) + (1 if verdict != "APPROVED" else 0)
                }
                
            with patch('core.orchestrator.nodes.reviewer_node', side_effect=side_effect_reviewer):
                graph = create_graph()
                initial_state = {
                    "messages": [],
                    "task_description": "Build a button",
                    "current_agent": "system",
                    "reviewer_verdict": "",
                    "human_approved": False,
                    "error_count": 0
                }
                
                for output in graph.stream(initial_state, config={"recursion_limit": 10}):
                    for node_name, state_update in output.items():
                        print(f"--> Reached node: {node_name}")
                        if "messages" in state_update and state_update["messages"]:
                            print(f"    Message: {state_update['messages'][-1].content}")
            
if __name__ == "__main__":
    test()
