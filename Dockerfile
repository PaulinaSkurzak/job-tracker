FROM python:3.12-slim

# Don't write .pyc files, and don't buffer output so logs show up immediately.
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirements first: Docker caches this layer, so code edits don't reinstall packages.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
