import subprocess

def run_in_sandbox(command: str) -> str:
    """
    Executes a command safely inside the Dev-OS Docker Sandbox.
    """
    # Wrap the command in docker exec
    docker_cmd = ["docker", "exec", "-i", "dev-os-sandbox", "/bin/bash", "-c", command]
    
    try:
        result = subprocess.run(
            docker_cmd,
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        return f"Error executing command in sandbox:\n{e.stderr}"
    except Exception as e:
        return f"Sandbox execution failed: {str(e)}"
