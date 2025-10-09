# 🎵 Track Miner - Multi-Source Music Downloader

A beautiful, user-friendly web application to download music from Spotify and YouTube with high-quality audio. Built with React, TypeScript, and Node.js, powered by `spotdl` and `yt-dlp`.

![Track Miner](public/placeholder.svg)

## 🌐 Deploy to the Cloud (FREE!)

Deploy your own Track Miner instance online for **$0.00/month**! 

👉 **[See Deployment Guide](START-HERE.md)** 👈

- ✅ **Frontend**: Netlify (Free)
- ✅ **Backend**: Render.com (Free)  
- ✅ **Hosting**: GitHub (Free)
- ⏱️ **Setup Time**: ~20 minutes

**Or run locally** (see installation below)

## ✨ Features

- 🎯 **Multi-Source Support**: Download from Spotify and YouTube
  - 🎵 Spotify tracks (individual songs)
  - 📁 Spotify playlists
  - 💿 **Spotify albums** (NEW!)
  - 🎤 **Spotify artists** (popular tracks) (NEW!)
  - 📺 YouTube videos/music
  - 📂 YouTube playlists
- 🎨 **Beautiful UI**: Modern, responsive design with real-time progress tracking
- ⚡ **Fast Downloads**: Multi-threaded downloads (1-16 threads)
- 🔄 **Automatic Retries**: Unlimited retries until all tracks are downloaded successfully
- 📊 **Real-time Progress**: Live updates via WebSocket connection
- 🎵 **High Quality**: Download in MP3 (320kbps), FLAC, or OGG format
- 📁 **Custom Folders**: Choose where to save your music
- ✅ **Track Selection**: Select specific tracks or download entire collections
- 🔍 **YouTube Search**: Search and download music directly from YouTube
- 📝 **Error Logging**: Failed downloads are logged for retry

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v16 or higher)
   - Download from [nodejs.org](https://nodejs.org/)

2. **Python** (v3.8 or higher)
   - Download from [python.org](https://www.python.org/)

3. **spotdl** (Python package)
   ```bash
   pip install spotdl
   ```

### Installation

1. **Clone or download this repository**

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

### Running the Application

#### Option 1: Easy Launcher (Windows)
Double-click `start-all.bat` to start both frontend and backend servers automatically.

#### Option 2: Manual Start

**Terminal 1 - Backend Server:**
```bash
# On Windows
start-server.bat

# On Mac/Linux
cd server
npm start
```

**Terminal 2 - Frontend:**
```bash
# On Windows
start-frontend.bat

# On Mac/Linux
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## 📖 How to Use

1. **Open the application** in your browser (http://localhost:5173)

2. **Get a Spotify playlist URL**
   - Open Spotify (web or desktop app)
   - Right-click on any playlist
   - Select "Copy Playlist Link"

3. **Paste the URL** into the input field and click "Load Playlist"

4. **Configure settings** (optional)
   - Choose audio format (MP3, FLAC, OGG)
   - Select quality (128k, 192k, 256k, 320k)
   - Adjust download threads (1-16)

5. **Select tracks** you want to download (or keep all selected)

6. **Click "Download"** and choose a folder name

7. **Wait for completion** - Watch real-time progress for each track

8. **Find your music** in your Downloads folder

## 🎛️ Configuration

### Download Settings

- **Audio Format**
  - **MP3**: Most compatible, smaller file size (Recommended)
  - **FLAC**: Lossless quality, larger file size
  - **OGG**: Vorbis codec, good balance

- **Audio Quality**
  - **128 kbps**: Good quality, smallest file size
  - **192 kbps**: Better quality
  - **256 kbps**: High quality
  - **320 kbps**: Best quality (Recommended)

- **Download Threads**
  - More threads = faster downloads
  - Recommended: 8 threads
  - Range: 1-16 threads

### Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

## 🔧 Technical Details

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Radix UI components
- Socket.IO client for real-time updates
- React Query for data fetching

**Backend:**
- Node.js with Express
- Socket.IO for WebSocket communication
- spotdl (Python) for downloading

### Project Structure

```
track-miner/
├── server/              # Backend server
│   ├── index.js        # Main server file
│   └── package.json    # Server dependencies
├── src/                # Frontend source
│   ├── components/     # React components
│   ├── services/       # API services
│   ├── types/          # TypeScript types
│   └── pages/          # Page components
├── public/             # Static assets
├── start-all.bat       # Windows launcher
├── start-server.bat    # Backend launcher
└── start-frontend.bat  # Frontend launcher
```

## 🔄 How It Works

1. **Playlist Loading**: The frontend sends the Spotify URL to the backend, which uses `spotdl` to fetch playlist metadata including track names, artists, albums, and artwork.

2. **Download Process**: When you click download, the backend:
   - Creates an output folder in your Downloads directory
   - Starts downloading tracks using `spotdl` with your chosen settings
   - Sends real-time progress updates via WebSocket

3. **Retry Logic**: If any track fails to download:
   - The error is logged
   - The download automatically retries
   - This continues until all tracks are successful (up to 10 attempts)

4. **Real-time Updates**: The frontend displays:
   - Current track being downloaded
   - Progress percentage for each track
   - Overall completion status
   - Any errors that occur

## 🛠️ Troubleshooting

### spotdl not found
```bash
pip install spotdl
# or
python -m pip install spotdl
```

### Port already in use
If port 3001 or 5173 is already in use, change the ports in:
- Backend: `server/index.js` (line 15)
- Frontend: Update `.env` file

### Downloads failing
- Check your internet connection
- Verify spotdl is properly installed: `python -m spotdl --version`
- Check the error log in the output folder: `failed_downloads.txt`

### WebSocket connection issues
- Ensure backend server is running
- Check firewall settings
- Verify `.env` configuration

## 📝 Comparison with Batch Script

This web application provides all the features of your original batch script, plus:

| Feature | Batch Script | Web App |
|---------|-------------|---------|
| Playlist URL Input | ✅ | ✅ |
| Custom Folder Names | ✅ | ✅ |
| Multiple Threads | ✅ | ✅ |
| Retry Logic | ✅ | ✅ |
| Error Logging | ✅ | ✅ |
| 320k Quality | ✅ | ✅ |
| Visual Progress | ❌ | ✅ |
| Track Selection | ❌ | ✅ |
| Playlist Preview | ❌ | ✅ |
| Multiple Formats | ❌ | ✅ |
| Real-time Updates | ❌ | ✅ |
| Modern UI | ❌ | ✅ |
| Cross-platform | ❌ | ✅ |

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## ⚠️ Disclaimer

This tool is for personal use only. Please respect copyright laws and only download music you have the right to download. This project is not affiliated with Spotify.

## 🙏 Acknowledgments

- [spotdl](https://github.com/spotDL/spotify-downloader) - The amazing tool that powers the downloads
- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Vite](https://vitejs.dev/) - Next generation frontend tooling

---

Made with ❤️ for music lovers everywhere
