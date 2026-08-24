import subprocess
import os
import sys

def run_command(command, cwd=None, env=None):
    print(f"Starting: {command} in {cwd or os.getcwd()}")
    return subprocess.Popen(
        command,
        shell=True,
        cwd=cwd,
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
        text=True
    )

def start_services():
    print("Starting services...")
    
    # 1. Install Node.js dependencies
    print("Installing Node.js dependencies...")
    subprocess.run("npm install", shell=True, cwd="app/backend", check=True)
    
    # Environment variables
    env = os.environ.copy()
    
    # 2. Start the Backend Worker
    worker_process = run_command("npx tsx src/workers/run.ts", cwd="app/backend", env=env)
    
    # 3. Start the Backend Dispatcher
    dispatcher_process = run_command("npx tsx src/outbox/run.ts", cwd="app/backend", env=env)
    
    # 4. Start the Docling Python Service
    ocr_process = run_command("python app/backend/services/ocr-engine/src/main.py", env=env)
    
    # 5. Start the Express API on port 7860 (the only port exposed by HF Spaces)
    env["PORT"] = "7860"
    api_process = run_command("npx tsx src/index.ts", cwd="app/backend", env=env)
    
    return [worker_process, dispatcher_process, ocr_process, api_process]

if __name__ == "__main__":
    processes = start_services()
    print("All background services started. Express API is listening on port 7860.")
    
    # Block on the API process so the container stays alive
    api_process = processes[-1]
    api_process.wait()
