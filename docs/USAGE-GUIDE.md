# 🎓 Usage Guide - Track Miner

Complete guide with screenshots descriptions and step-by-step instructions.

## 🎬 Getting Started

### Step 1: Launch the Application

**Windows:**
```
Double-click: start-all.bat
```

**What happens:**
- Two command windows open
- Backend server starts (port 3001)
- Frontend server starts (port 5173)
- Browser opens automatically (or go to http://localhost:5173)

**You should see:**
- Backend: Green ASCII art with "Server Running"
- Frontend: Beautiful Spotify-themed webpage

---

### Step 2: Get Your Spotify Playlist URL

**In Spotify (Web or Desktop):**

1. Find the playlist you want to download
2. Click the "..." (three dots) button
3. Click "Share"
4. Click "Copy link to playlist"

**Example URLs:**
```
https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
https://open.spotify.com/playlist/3cEYpjA9oz9GiPac4AsH4n
spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
```

**All formats work!**

---

### Step 3: Load the Playlist

**In Track Miner:**

1. Paste the URL in the large input box
2. Click the green "Load Playlist" button
3. Wait 5-10 seconds (depends on playlist size)

**What you'll see:**
- Loading spinner
- "Loading..." text
- Toast notification when complete

**After loading:**
- Playlist header with artwork
- Track count and duration
- Full list of tracks
- Download settings panel

---

### Step 4: Configure Download Settings

**Format Selection:**
- **MP3** (Recommended): Works everywhere, good size
- **FLAC**: Lossless quality, large files
- **OGG**: Vorbis codec, good balance

**Quality Selection:**
- **128k**: Basic quality, smallest size
- **192k**: Good quality
- **256k**: High quality
- **320k**: Best quality (Recommended)

**Thread Count:**
- **Low (1-4)**: Slower, less CPU usage
- **Medium (5-8)**: Balanced (Recommended)
- **High (9-16)**: Fastest, more CPU usage

**Example Settings:**
```
Format: MP3
Quality: 320k
Threads: 8
```

---

### Step 5: Select Tracks

**Options:**

1. **Download All**
   - All tracks checked by default
   - Just click Download

2. **Select Specific Tracks**
   - Uncheck tracks you don't want
   - Selected count updates automatically

3. **Quick Actions**
   - "Select All" checkbox in header
   - Toggle all tracks at once

**Track List Shows:**
- ✅ Checkbox for selection
- 🎵 Track number
- 🖼️ Album artwork
- 📝 Track name
- 👤 Artist name
- 💿 Album name
- ⏱️ Duration
- 📊 Status (Pending/Downloading/Complete/Failed)

---

### Step 6: Choose Folder Name

**Click "Download" button:**

A dialog appears asking for folder name.

**Default:** Playlist name (auto-filled)

**Examples:**
```
Summer Hits 2024
Workout Mix
Road Trip Songs
Study Music
```

**Special characters removed automatically!**

**Full path shown:**
```
~/Downloads/YourFolderName
```

---

### Step 7: Start Download

**Click "Start Download":**

**What happens:**
1. Folder created in Downloads
2. Backend starts downloading
3. Real-time progress appears

**Progress Display:**
- 🔵 Downloading: Blue spinner + percentage
- ✅ Completed: Green checkmark
- ❌ Failed: Red X (will retry automatically)

**Overall Progress:**
- Progress bar at top
- Completed count
- Failed count (if any)
- Percentage complete

---

### Step 8: Monitor Progress

**Watch in real-time:**
- Each track shows progress bar
- Percentage updates live
- Status icons change
- Toast notifications for events

**Status Messages:**
- "Starting download..."
- "Downloading track X..."
- "X tracks failed. Retrying..."
- "All tracks downloaded successfully!"

**Retry Logic:**
- Failed tracks retry automatically
- Up to 10 attempts per batch
- No manual intervention needed
- Just wait!

---

### Step 9: Download Complete

**Success Indicators:**
- ✅ All tracks show green checkmarks
- 🎉 Success toast notification
- 📁 Output folder path displayed
- 💯 "100% complete" message

**Find Your Files:**
```
Windows: C:\Users\YourName\Downloads\FolderName
Mac: /Users/YourName/Downloads/FolderName
Linux: /home/yourname/Downloads/FolderName
```

**File Format:**
```
Artist - Track Title.mp3
```

**Example:**
```
The Weeknd - Blinding Lights.mp3
Dua Lipa - Levitating.mp3
```

---

## 🎯 Common Workflows

### Workflow 1: Quick Download (Default Settings)
```
1. Paste URL
2. Load Playlist
3. Click Download
4. Click Start Download
5. Done!
```

### Workflow 2: Selective Download
```
1. Paste URL
2. Load Playlist
3. Uncheck unwanted tracks
4. Click Download
5. Choose folder name
6. Start Download
```

### Workflow 3: High Quality Download
```
1. Paste URL
2. Load Playlist
3. Set Format: FLAC
4. Set Quality: 320k
5. Set Threads: 8
6. Click Download
7. Start Download
```

### Workflow 4: Fast Batch Download
```
1. Paste URL
2. Load Playlist
3. Set Threads: 16
4. Set Quality: 256k
5. Click Download
6. Start Download
```

---

## 🎨 UI Elements Explained

### Header Section
- **Logo**: Track Miner branding
- **Title**: "Spotify Playlist Downloader"
- **Description**: Feature highlights
- **Stats**: Unlimited downloads, 320k quality, 100% success

### Input Section
- **URL Input**: Large text box for playlist URL
- **Load Button**: Green button to fetch playlist
- **Validation**: Red error if URL invalid
- **Pro Tip**: Help text at bottom

### Settings Panel
- **Format Dropdown**: Choose audio format
- **Quality Dropdown**: Choose bitrate
- **Thread Slider**: Adjust performance
- **Tip Box**: Recommendation at bottom

### Playlist Header
- **Artwork**: Large playlist cover image
- **Title**: Playlist name
- **Description**: Playlist description
- **Stats**: Owner, track count, duration
- **Spotify Link**: Open in Spotify button

### Track List
- **Header Controls**: Select All checkbox, Download button
- **Track Rows**: Each song with all info
- **Progress Section**: Overall stats
- **Expand/Collapse**: Hide/show track list

### Notifications
- **Success**: Green toast (top-right)
- **Error**: Red toast (top-right)
- **Info**: Blue toast (top-right)
- **Warning**: Yellow toast (top-right)

---

## 💡 Pro Tips & Tricks

### Tip 1: Test First
Always test with a small playlist (5-10 tracks) first to verify everything works.

### Tip 2: Best Settings
For most users: MP3, 320k, 8 threads = perfect balance

### Tip 3: Folder Organization
Use descriptive names:
- "Gym 2024"
- "Road Trip - Summer"
- "Study Focus"

### Tip 4: Internet Connection
Stable internet = faster downloads. Don't download on flaky WiFi.

### Tip 5: Disk Space
Check you have enough space:
- MP3 320k: ~10-15 MB per track
- FLAC: ~30-50 MB per track

### Tip 6: Let It Retry
If tracks fail, just wait. The retry system will handle it!

### Tip 7: Multiple Playlists
Download one playlist at a time for best results.

### Tip 8: Thread Count
More threads ≠ always better. 8-12 is the sweet spot.

### Tip 9: Quality vs Size
- 320k MP3: Great quality, reasonable size ✅
- FLAC: Perfect quality, huge size
- 256k MP3: Good quality, smaller size

### Tip 10: Backup
Keep your downloads backed up! Hard drives fail.

---

## 🎵 Example Download Session

**Scenario:** Download "Today's Top Hits" playlist

**Step-by-step:**

1. **Open Spotify** → Find "Today's Top Hits"
2. **Copy URL** → Right-click → Share → Copy Link
3. **Open Track Miner** → http://localhost:5173
4. **Paste URL** → Click in input box → Ctrl+V
5. **Load** → Click "Load Playlist" → Wait 5 seconds
6. **Review** → See 50 tracks loaded
7. **Settings** → Keep defaults (MP3, 320k, 8 threads)
8. **Download** → Click green "Download" button
9. **Folder** → Name it "Top Hits 2024"
10. **Start** → Click "Start Download"
11. **Wait** → Watch progress (5-10 minutes)
12. **Complete** → See success message!
13. **Listen** → Open Downloads\Top Hits 2024

**Result:** 50 high-quality MP3s in your Downloads folder! 🎉

---

## 🔄 Retry System Explained

### How It Works

1. **Initial Download**: All selected tracks start downloading
2. **Error Detection**: If any track fails, it's logged
3. **Automatic Retry**: Failed tracks retry immediately
4. **Repeat**: Up to 10 retry attempts
5. **Success**: Continues until all tracks complete

### What You See

**Attempt 1:**
```
Downloading 50 tracks...
✅ 45 completed
❌ 5 failed
```

**Attempt 2:**
```
5 tracks failed. Retrying...
✅ 3 completed
❌ 2 failed
```

**Attempt 3:**
```
2 tracks failed. Retrying...
✅ 2 completed
🎉 All tracks downloaded!
```

### Error Log

Failed downloads are logged to:
```
~/Downloads/FolderName/failed_downloads.txt
```

Check this file if issues persist.

---

## ✅ Success Checklist

Before downloading, ensure:
- [ ] Backend server running (green message)
- [ ] Frontend loaded (beautiful UI visible)
- [ ] WebSocket connected (check browser console)
- [ ] Valid Spotify URL
- [ ] Playlist loaded successfully
- [ ] Settings configured
- [ ] Tracks selected
- [ ] Enough disk space
- [ ] Stable internet connection

During download:
- [ ] Progress bars updating
- [ ] Toast notifications appearing
- [ ] No error messages
- [ ] Retry attempts (if needed) working

After download:
- [ ] All tracks completed (green checkmarks)
- [ ] Success message shown
- [ ] Files in Downloads folder
- [ ] Correct file format
- [ ] Files playable

---

**Happy Downloading! 🎵**

For more help, see:
- **Quick Start**: QUICKSTART.md
- **Full Docs**: README.md
- **Setup Help**: SETUP.md
- **Features**: FEATURES.md

