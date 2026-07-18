import typer
import uvicorn
from fastapi import FastAPI, Request
from dotenv import load_dotenv
from core.orchestrator.graph import create_graph

# Load environment variables (e.g. GOOGLE_API_KEY)
load_dotenv()

app = typer.Typer()
api = FastAPI()

def execute_workflow(task_description: str):
    graph = create_graph()
    initial_state = {
        "messages": [],
        "task_description": task_description,
        "current_agent": "system",
        "reviewer_verdict": "",
        "human_approved": False,
        "error_count": 0
    }
    
    for output in graph.stream(initial_state, config={"recursion_limit": 50}):
        for node_name, state_update in output.items():
            print(f"\n[{node_name.upper()}]:")
            if "messages" in state_update and state_update["messages"]:
                print(state_update["messages"][-1].content)

@app.command()
def run_task(task_description: str):
    """
    Run a task through the Dev-OS multi-agent graph.
    """
    typer.echo(f"Starting Dev-OS workflow for: {task_description}")
    execute_workflow(task_description)

@api.post("/webhook")
async def receive_webhook(request: Request):
    """
    Webhook endpoint to receive CI/CD failure logs and trigger a fix workflow.
    """
    data = await request.json()
    if data.get("status") == "failed":
        logs = data.get("logs", "No logs provided.")
        branch = data.get("branch", "unknown")
        commit = data.get("commit", "unknown")
        
        task_description = (
            f"CI Pipeline failed on branch '{branch}' (commit: {commit}).\n"
            f"Please review the logs and fix the issue:\n\n{logs}"
        )
        
        print(f"Received webhook failure from GitHub Actions. Starting Dev-OS workflow...")
        
        # In a real app, this should run asynchronously (e.g. via Celery or BackgroundTasks)
        # to prevent blocking the webhook response.
        import threading
        threading.Thread(target=execute_workflow, args=(task_description,)).start()
        
        return {"message": "Webhook received. Workflow started.", "status": "processing"}
        
    return {"message": "No failure detected.", "status": "ignored"}

@app.command()
def serve(port: int = 8000):
    """
    Start the Dev-OS server to listen for GitHub Actions webhooks.
    """
    typer.echo(f"Starting Dev-OS webhook server on port {port}...")
    uvicorn.run(api, host="0.0.0.0", port=port)

if __name__ == "__main__":
    app()
