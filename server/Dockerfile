# Use Node.js 18 as base image (includes npm)
FROM node:18-slim

# Install Python 3.11 and pip
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for python and pip commands (if they don't exist)
RUN ln -sf /usr/bin/python3.11 /usr/bin/python3 && \
    ln -sf /usr/bin/python3.11 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY requirements.txt ./

# Install Node.js dependencies
RUN npm install

# Install Python dependencies in virtual environment
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 3001

# Set PATH to include virtual environment
ENV PATH="/opt/venv/bin:$PATH"

# Start the server
CMD ["node", "index.js"]

