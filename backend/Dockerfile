# ============================================================
# OPTICORE BACKEND DOCKERFILE
# Python 3.11 Slim with PyTorch CPU & Ultralytics YOLOv8
# ============================================================

FROM python:3.11-slim

# Prevent Python from writing .pyc files & buffer output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install essential system dependencies for OpenCV and healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU (lightweight x86_64 wheel from PyTorch repo, or standard wheel on aarch64)
RUN ARCH=$(uname -m) && \
    pip install --no-cache-dir --upgrade pip setuptools wheel && \
    if [ "$ARCH" = "x86_64" ]; then \
        pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu; \
    else \
        pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu torch torchvision; \
    fi

# Copy requirements and install remaining packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source code
COPY . .

# Ensure data and models directory exist
RUN mkdir -p /app/data /app/models

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
