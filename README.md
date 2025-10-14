# 🎵 Track Miner - Multi-Source Music Downloader

A beautiful, user-friendly web application to download music from Spotify and YouTube with high-quality audio. Built with React, TypeScript, and Node.js, powered by `spotdl` and `yt-dlp`.

![Track Miner](public/placeholder.svg)

## 🌐 Live Deployment

This project is deployed and running on:
- ✅ **Frontend**: Vercel (Free tier)
- ✅ **Backend**: Railway (Free tier)

## 🚀 Quick Start for Local Development

### Prerequisites

1. **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
2. **Python** (v3.8 or higher) - [Download here](https://www.python.org/)
3. **spotdl** (Python package)
   ```bash
   pip install spotdl
   ```

### Installation

1. **Clone this repository**
   ```bash
   git clone <your-repo-url>
   cd test
   ```

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

### Running Locally

#### Windows Users (Easy Start)
Navigate to the `scripts/` folder and run:
- **Start Everything**: Double-click `start-all.bat`
- **Start Backend Only**: Double-click `start-server.bat`
- **Start Frontend Only**: Double-click `start-frontend.bat`

#### Mac/Linux Users
**Terminal 1 - Backend:**
```bash
cd server
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## ✨ Features

- 🎯 **Multi-Source Support**: Download from Spotify and YouTube
  - 🎵 Spotify tracks (individual songs)
  - 📁 Spotify playlists
  - 💿 Spotify albums
  - 🎤 Spotify artists (popular tracks)
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
- 🎧 **Live Listening**: Real-time collaborative listening sessions
- 🔗 **Share Playlists**: Share playlists with friends via links

## 📖 How to Use

1. Open the application in your browser
2. Get a Spotify playlist/album/artist URL or YouTube link
   - Right-click on any playlist/album in Spotify
   - Select "Copy Link"
3. Paste the URL into the input field and click "Load Playlist"
4. Configure settings (optional):
   - Choose audio format (MP3, FLAC, OGG)
   - Select quality (128k, 192k, 256k, 320k)
   - Adjust download threads (1-16)
5. Select tracks you want to download (or keep all selected)
6. Click "Download" and choose a folder name
7. Wait for completion - Watch real-time progress for each track
8. Find your music in your Downloads folder

## 📂 Project Structure

```
test/
├── api/                    # Vercel serverless functions
├── docs/                   # 📚 All project documentation
├── public/                 # Static assets (icons, images)
├── scripts/                # 🔧 Utility scripts (.bat files for Windows)
├── server/                 # 🖥️ Backend server (Railway deployment)
│   ├── index.js           # Main server file
│   ├── package.json       # Server dependencies
│   ├── Dockerfile.railway # Railway deployment config
│   └── proxy-manager.js   # Proxy handling
├── src/                    # ⚛️ Frontend source (Vercel deployment)
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries
│   ├── pages/             # Page components
│   ├── services/          # API services
│   └── types/             # TypeScript type definitions
├── .gitignore             # Git ignore rules
├── index.html             # HTML entry point
├── package.json           # Frontend dependencies
├── railway.json           # Railway deployment config
├── vercel.json            # Vercel deployment config
├── vite.config.ts         # Vite configuration
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory (copy from `env.example`):

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

For production, update these to your Railway backend URL.

## 🚀 Deployment

### Frontend (Vercel)
1. Push your code to GitHub
2. Import project on [Vercel](https://vercel.com)
3. Set environment variables pointing to your Railway backend
4. Deploy automatically on each push to main

### Backend (Railway)
1. Push your code to GitHub
2. Import project on [Railway](https://railway.app)
3. Railway will auto-detect the Dockerfile and deploy
4. Copy your Railway URL and update Vercel environment variables

📚 **Detailed deployment guides available in `docs/` folder**

## 📚 Documentation

All detailed documentation has been moved to the `docs/` folder:
- Deployment guides (Railway, Vercel, Render, etc.)
- Feature documentation
- Troubleshooting guides
- Development notes

## 🔧 Technical Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS + Radix UI
- Socket.IO client for real-time updates
- React Query for data fetching

### Backend
- Node.js with Express
- Socket.IO for WebSocket communication
- spotdl and yt-dlp for downloads

## 🛠️ Troubleshooting

### spotdl not found
```bash
pip install spotdl
# or
python -m pip install spotdl
```

### Port already in use
Change ports in:
- Backend: `server/index.js`
- Frontend: `.env` file

### WebSocket connection issues
- Ensure backend server is running
- Check firewall settings
- Verify `.env` configuration matches your backend URL

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## ⚠️ Disclaimer

This tool is for personal use only. Please respect copyright laws and only download music you have the right to download. This project is not affiliated with Spotify or YouTube.

## 🙏 Acknowledgments

- [spotdl](https://github.com/spotDL/spotify-downloader) - Powers Spotify downloads
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Powers YouTube downloads
- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Vite](https://vitejs.dev/) - Next generation frontend tooling

---

Made with ❤️ for music lovers everywhere
