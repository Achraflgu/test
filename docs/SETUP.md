# 🛠️ Setup Guide - Track Miner

Complete step-by-step setup guide for Windows, Mac, and Linux.

## Windows Setup

### 1. Install Node.js

1. Download Node.js from https://nodejs.org/
2. Run the installer
3. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

### 2. Install Python

1. Download Python from https://www.python.org/downloads/
2. **IMPORTANT**: Check "Add Python to PATH" during installation
3. Verify installation:
   ```cmd
   python --version
   pip --version
   ```

### 3. Install spotdl

```cmd
pip install spotdl
```

Verify:
```cmd
python -m spotdl --version
```

### 4. Setup Track Miner

1. Extract the project files
2. Open Command Prompt in the project folder
3. Install frontend dependencies:
   ```cmd
   npm install
   ```
4. Install backend dependencies:
   ```cmd
   cd server
   npm install
   cd ..
   ```

### 5. Run the Application

**Easy way** - Double-click `start-all.bat`

**Manual way**:
- Open two Command Prompts
- In first: `start-server.bat`
- In second: `start-frontend.bat`

### 6. Access the App

Open your browser and go to: http://localhost:5173

---

## Mac/Linux Setup

### 1. Install Node.js

**Mac (using Homebrew):**
```bash
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify:
```bash
node --version
npm --version
```

### 2. Install Python

**Mac:**
```bash
brew install python
```

**Linux:**
```bash
sudo apt-get install python3 python3-pip
```

Verify:
```bash
python3 --version
pip3 --version
```

### 3. Install spotdl

```bash
pip3 install spotdl
```

Verify:
```bash
python3 -m spotdl --version
```

### 4. Setup Track Miner

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 5. Create Start Scripts

**Backend script** (`start-server.sh`):
```bash
#!/bin/bash
cd server
node index.js
```

**Frontend script** (`start-frontend.sh`):
```bash
#!/bin/bash
npm run dev
```

Make executable:
```bash
chmod +x start-server.sh start-frontend.sh
```

### 6. Run the Application

Terminal 1 - Backend:
```bash
./start-server.sh
```

Terminal 2 - Frontend:
```bash
./start-frontend.sh
```

### 7. Access the App

Open your browser and go to: http://localhost:5173

---

## Environment Configuration

### Optional: Custom Ports

If you need to use different ports:

1. Create `.env` file in the root directory:
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_WS_URL=http://localhost:3001
   ```

2. Edit `server/index.js` line 15 to change backend port:
   ```javascript
   const PORT = process.env.PORT || 3001; // Change 3001 to your port
   ```

---

## Verification Steps

### Test Backend

1. Start the backend server
2. Open http://localhost:3001/api/health in browser
3. You should see:
   ```json
   {
     "status": "ok",
     "spotdlInstalled": true,
     "version": "spotdl v4.x.x"
   }
   ```

### Test Frontend

1. Start the frontend server
2. Open http://localhost:5173
3. You should see the Track Miner homepage

### Test Full System

1. Start both servers
2. Open the app
3. Paste a Spotify playlist URL
4. Click "Load Playlist"
5. If tracks appear, everything is working!

---

## Common Issues

### Issue: "spotdl not found"

**Windows:**
```cmd
python -m pip install --upgrade spotdl
```

**Mac/Linux:**
```bash
pip3 install --upgrade spotdl
```

### Issue: "Port already in use"

Find and kill the process:

**Windows:**
```cmd
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
lsof -ti:3001 | xargs kill -9
```

### Issue: "Python not found"

Make sure Python is in your PATH:

**Windows:**
1. Search "Environment Variables"
2. Add Python to PATH
3. Restart Command Prompt

**Mac/Linux:**
- Python should be available as `python3`

### Issue: "Module not found" errors

Reinstall dependencies:
```bash
# Frontend
npm install

# Backend
cd server
npm install
```

### Issue: Downloads not starting

1. Check backend console for errors
2. Verify spotdl installation: `python -m spotdl --version`
3. Check browser console (F12) for errors
4. Ensure WebSocket connection is established

---

## Performance Tuning

### Optimize Download Speed

1. **Increase Threads**: Set to 8-12 for faster downloads
2. **Network**: Ensure stable internet connection
3. **Disk Space**: Make sure you have enough space in Downloads folder

### Reduce CPU Usage

1. **Lower Threads**: Use 4-6 threads instead of 16
2. **One Playlist at a Time**: Don't run multiple downloads simultaneously

---

## Security Notes

- The app only runs locally on your machine
- No data is sent to external servers (except Spotify for metadata)
- Downloads are saved to your local Downloads folder
- WebSocket connection is local only (localhost)

---

## Next Steps

Once everything is set up:
1. Read the main README.md for usage instructions
2. Try downloading a small playlist first
3. Experiment with different quality settings
4. Enjoy your music! 🎵

---

Need help? Check the main README.md or open an issue on GitHub.

