#!/usr/bin/env bash
# Render.com build script for backend
# This installs all required dependencies

set -e  # Exit on error

echo "🔨 Installing backend dependencies..."
npm install

echo "🐍 Installing Python dependencies..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt || python3 -m pip install spotdl yt-dlp pytubefix

echo "✅ Build complete!"

