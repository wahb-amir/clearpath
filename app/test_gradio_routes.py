import gradio as gr

def dummy(): pass

with gr.Blocks() as demo:
    gr.Button("Refresh").click(dummy)

demo.launch(prevent_thread_lock=True)

routes = demo.app.router.routes
for r in routes:
    if hasattr(r, "path"):
        print(f"[{getattr(r, 'methods', None)}] {r.path}")

