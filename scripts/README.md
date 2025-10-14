# 🔧 Scripts

This folder contains utility scripts for Windows users to make development easier.

## 🚀 Quick Start Scripts

### `start-all.bat`
**Starts both frontend and backend servers simultaneously**
- Opens two command windows
- One for the backend server (port 3001)
- One for the frontend dev server (port 5173)
- **Usage**: Double-click this file to start everything at once

### `start-frontend.bat`
**Starts only the frontend development server**
- Runs `npm run dev`
- Opens at http://localhost:5173
- **Usage**: Double-click when you only need the frontend

### `start-server.bat`
**Starts only the backend server**
- Changes to `server/` directory
- Runs `node index.js`
- Listens on http://localhost:3001
- **Usage**: Double-click when you only need the backend

## 🛠️ Utility Scripts

### `install-dependencies.bat`
**Installs all project dependencies**
- Installs frontend dependencies (`npm install`)
- Installs backend dependencies (`cd server && npm install`)
- **Usage**: Run once after cloning the repository

### `restart-all.bat`
**Restarts both servers**
- Kills any existing node processes
- Starts fresh instances of both servers
- **Usage**: When you need a clean restart

### `update-ytdlp.bat`
**Updates yt-dlp to the latest version**
- Ensures you have the latest YouTube download capabilities
- Recommended to run monthly
- **Usage**: Double-click when YouTube downloads stop working

### `check-ffmpeg.bat`
**Verifies ffmpeg installation**
- Checks if ffmpeg is properly installed
- Required for audio conversion
- **Usage**: Run if you have audio conversion issues

### `CHECK-SETUP.bat`
**Verifies your development environment**
- Checks for Node.js installation
- Checks for Python installation
- Checks for spotdl installation
- **Usage**: Run this first if you encounter any issues

### `cleanup-incomplete-files.bat`
**Removes incomplete/corrupted downloads**
- Cleans up failed download files
- Removes temporary files
- **Usage**: Run after failed download sessions

### `clean-server-folder.bat`
**Cleans server temporary files**
- Removes logs and temp files from server directory
- Doesn't delete important configuration
- **Usage**: When server folder gets cluttered

## 📝 Notes for Mac/Linux Users

These are Windows batch files (`.bat`). For Mac/Linux, use these equivalent commands:

**Start all:**
```bash
# Terminal 1
cd server && npm start

# Terminal 2 (new terminal)
npm run dev
```

**Install dependencies:**
```bash
npm install
cd server && npm install && cd ..
```

**Update yt-dlp:**
```bash
pip install --upgrade yt-dlp
```

---

For more information, see the main [README.md](../README.md)

