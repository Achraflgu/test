#!/bin/bash
# Render.com build script for backend
# This installs all required dependencies

echo "🔨 Installing backend dependencies..."
npm install

echo "🐍 Installing Python dependencies..."
pip install --upgrade pip
pip install spotdl yt-dlp

echo "🎵 Installing FFmpeg..."
apt-get update
apt-get install -y ffmpeg

echo "✅ Build complete!"

