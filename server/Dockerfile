# Optimized Dockerfile for Railway (Debian-based, memory-efficient)
FROM node:18-slim

# Install Python 3, pip, and venv (use python3 instead of python3.11 for better compatibility)
# Split into separate RUN commands to reduce memory pressure during build
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install Node.js dependencies (using npm install for compatibility)
RUN npm install --only=production --no-audit --no-fund

# Copy requirements.txt (for better Docker layer caching)
COPY requirements.txt ./

# Install Python dependencies in virtual environment (memory-efficient)
# Split pip install to reduce memory usage during build
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy application code (last, for better caching)
COPY . .

# Set PATH to include virtual environment
ENV PATH="/opt/venv/bin:$PATH"

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "index.js"]

