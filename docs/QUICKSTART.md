# ⚡ Quick Start Guide

Get Track Miner running in 5 minutes!

## 🎯 Prerequisites Check

Open Command Prompt and check if you have everything:

```cmd
node --version    # Should show v16 or higher
python --version  # Should show 3.8 or higher
```

If any command fails, install the missing software:
- **Node.js**: https://nodejs.org/ (Download LTS version)
- **Python**: https://www.python.org/ (Check "Add to PATH" during install)

## 📦 Installation

### Step 1: Install spotdl

```cmd
pip install spotdl
```

Wait for it to complete, then verify:
```cmd
python -m spotdl --version
```

### Step 2: Install Dependencies

In the project folder:

```cmd
npm install
```

Then install backend dependencies:

```cmd
cd server
npm install
cd ..
```

## 🚀 Running the App

### Windows - Super Easy Way

Just double-click: **`start-all.bat`**

That's it! Two windows will open:
- Backend server (runs spotdl)
- Frontend web app

### Manual Way (All platforms)

**Terminal 1** - Start Backend:
```cmd
cd server
node index.js
```

**Terminal 2** - Start Frontend:
```cmd
npm run dev
```

## 🌐 Access the App

Open your browser and go to:
```
http://localhost:5173
```

## 🎵 Download Your First Playlist

1. **Get a Spotify URL**:
   - Open Spotify (web or app)
   - Right-click any playlist
   - Click "Copy Playlist Link"

2. **In Track Miner**:
   - Paste the URL in the input box
   - Click "Load Playlist"
   - Wait a few seconds for tracks to load

3. **Configure & Download**:
   - Choose format (MP3 recommended)
   - Choose quality (320k recommended)
   - Set threads (8 recommended)
   - Click "Download"
   - Choose a folder name
   - Click "Start Download"

4. **Wait & Enjoy**:
   - Watch real-time progress
   - Files saved to: `C:\Users\YourName\Downloads\FolderName`

## ✅ Success Indicators

When everything is working, you'll see:

**Backend Console:**
```
╔════════════════════════════════════════════════════════════╗
║     🎵 Spotify Playlist Downloader Server Running 🎵      ║
╠════════════════════════════════════════════════════════════╣
║  Server: http://localhost:3001                            ║
║  Status: Ready to download playlists                       ║
╚════════════════════════════════════════════════════════════╝
```

**Frontend:**
- Beautiful green UI
- "Spotify Playlist Downloader" heading
- Input box ready for URL

**Browser Console** (F12):
- "WebSocket connected" message

## 🆘 Quick Troubleshooting

### Error: "spotdl not found"
```cmd
pip install spotdl
```

### Error: "Port already in use"
Close other apps using ports 3001 or 5173, or:
```cmd
# Windows - Kill process on port 3001
netstat -ano | findstr :3001
taskkill /PID <number> /F
```

### Downloads not starting
1. Check backend console for errors
2. Make sure both servers are running
3. Try refreshing the browser
4. Check if spotdl works: `python -m spotdl --version`

### WebSocket not connecting
1. Restart both servers
2. Clear browser cache
3. Check firewall settings

## 🎛️ Recommended Settings

**For Best Quality:**
- Format: MP3
- Quality: 320k
- Threads: 8

**For Speed:**
- Format: MP3
- Quality: 256k
- Threads: 12

**For Lossless:**
- Format: FLAC
- Quality: 320k
- Threads: 8

## 📁 Where Are My Files?

Default location: `C:\Users\YourUsername\Downloads\PlaylistName\`

Files are named: `Artist - Track Title.mp3`

## 💡 Pro Tips

1. **Select Tracks**: Uncheck tracks you don't want before downloading
2. **Folder Names**: Use descriptive names like "Workout Mix 2024"
3. **Quality vs Size**: 320k MP3 is the sweet spot (good quality, reasonable size)
4. **Threads**: More threads = faster, but uses more CPU (8 is balanced)
5. **Retry Logic**: Failed tracks automatically retry - just wait!

## 🎉 You're Ready!

Everything set up? Here's what to try:

1. ✅ Download a small playlist (5-10 tracks) to test
2. ✅ Try different quality settings
3. ✅ Experiment with track selection
4. ✅ Download your favorite playlists!

## 📚 Learn More

- **Full Documentation**: See `README.md`
- **Detailed Setup**: See `SETUP.md`
- **Troubleshooting**: Check `README.md` troubleshooting section

---

**Happy Downloading! 🎵**

