FROM python:3.12-slim

# Install minimal OS dependencies required for OpenCV / ONNX Runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run the headless worker entrypoint
CMD ["python", "src/main.py"]