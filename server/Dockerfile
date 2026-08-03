# Production Dockerfile for Fly.io (Debian-based, Node 24 LTS, high performance)
FROM node:24-slim

# Install system dependencies: curl, ca-certificates, Python 3, pip, venv, ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install Node.js production dependencies (npm ci = reproducible from lockfile)
RUN npm ci --omit=dev --no-audit --no-fund

# Copy requirements.txt
COPY requirements.txt ./

# Setup virtual environment & upgrade Python tools to latest versions
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade -r requirements.txt && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade yt-dlp spotdl pytubefix

# Set PATH to include virtual environment
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "index.js"]

