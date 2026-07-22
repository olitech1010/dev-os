from langchain_core.messages import AIMessage
from unittest.mock import patch
from core.orchestrator.graph import create_graph

class MockLLM:
    def invoke(self, messages):
        return AIMessage(content="Mocked LLM Response")

def test_graph_routing_success():
    """
    Test that the graph routes orchestrator -> developer -> reviewer -> human -> END
    """
    with patch('core.orchestrator.nodes.get_llm', return_value=MockLLM()):
        # Mock input so the human checkpoint doesn't hang or fail
        with patch('builtins.input', return_value='y'):
            
            call_count = [0]
            
            def side_effect_reviewer(state):
                call_count[0] += 1
                # Loop once
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
                
            with patch('core.orchestrator.graph.reviewer_node', side_effect=side_effect_reviewer):
                graph = create_graph()
                initial_state = {
                    "messages": [],
                    "task_description": "Build a button",
                    "current_agent": "system",
                    "reviewer_verdict": "",
                    "human_approved": False,
                    "error_count": 0
                }
                
                output_nodes = []
                for output in graph.stream(initial_state, config={"recursion_limit": 10}):
                    for node_name, state_update in output.items():
                        output_nodes.append(node_name)
                        
                # Expect route: orchestrator -> developer -> reviewer -> developer -> reviewer -> human
                assert output_nodes == [
                    "orchestrator", 
                    "developer", 
                    "reviewer", 
                    "developer", 
                    "reviewer", 
                    "human"
                ]

def test_graph_human_rejection():
    """
    Test that if human rejects, it goes back to developer.
    """
    with patch('core.orchestrator.nodes.get_llm', return_value=MockLLM()):
        # Human rejects the first time, accepts the second time
        with patch('builtins.input', side_effect=['n', 'y']):
            
            def side_effect_reviewer(state):
                return {
                    "messages": [AIMessage(content=f"Reviewer output: APPROVED")],
                    "current_agent": "reviewer",
                    "reviewer_verdict": "APPROVED",
                    "error_count": state.get("error_count", 0)
                }
            
            with patch('core.orchestrator.graph.reviewer_node', side_effect=side_effect_reviewer):
                graph = create_graph()
                initial_state = {
                    "messages": [],
                    "task_description": "Build a button",
                    "current_agent": "system",
                    "reviewer_verdict": "",
                    "human_approved": False,
                    "error_count": 0
                }
                
                output_nodes = []
                for output in graph.stream(initial_state, config={"recursion_limit": 10}):
                    for node_name, state_update in output.items():
                        output_nodes.append(node_name)
                        
                # orchestrator -> developer -> reviewer -> human (reject) -> developer -> reviewer -> human (approve)
                assert output_nodes == [
                    "orchestrator", 
                    "developer", 
                    "reviewer", 
                    "human",
                    "developer", 
                    "reviewer", 
                    "human"
                ]
