import asyncio
from fastapi import FastAPI
from starlette.middleware import Middleware
from starlette.testclient import TestClient

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

client = TestClient(app)
print("Before:", client.get("/").json())

class MyMiddleware:
    def __init__(self, app):
        self.app = app
    async def __call__(self, scope, receive, send):
        async def send_wrapper(msg):
            if msg["type"] == "http.response.start":
                msg["headers"].append((b"x-my-header", b"foo"))
            await send(msg)
        await self.app(scope, receive, send_wrapper)

app.user_middleware.insert(0, Middleware(MyMiddleware))
app.middleware_stack = None
app.build_middleware_stack()

client2 = TestClient(app)
print("After headers:", client2.get("/").headers.get("x-my-header"))
