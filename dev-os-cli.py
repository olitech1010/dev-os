import typer
from dotenv import load_dotenv
from core.orchestrator.graph import create_graph

# Load environment variables (e.g. GOOGLE_API_KEY)
load_dotenv()

app = typer.Typer()

@app.command()
def run_task(task_description: str):
    """
    Run a task through the Dev-OS multi-agent graph.
    """
    typer.echo(f"Starting Dev-OS workflow for: {task_description}")
    
    graph = create_graph()
    
    # Initialize state
    initial_state = {
        "messages": [],
        "task_description": task_description,
        "current_agent": "system",
        "reviewer_verdict": "",
        "human_approved": False,
        "error_count": 0
    }
    
    # Stream the graph execution
    for output in graph.stream(initial_state, config={"recursion_limit": 50}):
        for node_name, state_update in output.items():
            typer.echo(f"\n[{node_name.upper()}]:")
            if "messages" in state_update and state_update["messages"]:
                typer.echo(state_update["messages"][-1].content)

if __name__ == "__main__":
    app()
