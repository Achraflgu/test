# 🎵 Spotify Album & Artist Support

## ✨ New Feature Added

TrackMiner now supports **Spotify Albums** and **Spotify Artists** in addition to playlists and tracks!

## 🎯 What's New?

### **Supported Spotify URL Types:**

| Type | Icon | Example | What You Get |
|------|------|---------|--------------|
| **Track** | 🎵 | `https://open.spotify.com/track/...` | Single song |
| **Playlist** | 📁 | `https://open.spotify.com/playlist/...` | All playlist tracks |
| **Album** | 💿 | `https://open.spotify.com/album/...` | **NEW!** All album tracks |
| **Artist** | 🎤 | `https://open.spotify.com/artist/...` | **NEW!** Artist's popular tracks |

## 📖 How to Use

### **Download an Album:**

1. Go to Spotify and find an album (e.g., [ISK - Hannibal](https://open.spotify.com/album/6HNaT9M3f1Pe4B32y3WfOq))
2. Copy the album URL
3. Paste it into TrackMiner's "Enter Music URL" input
4. Click "Load Music"
5. All album tracks will be loaded! 💿

**Example:**
```
https://open.spotify.com/album/6HNaT9M3f1Pe4B32y3WfOq
```

### **Download an Artist's Popular Tracks:**

1. Go to Spotify and find an artist (e.g., [ISK](https://open.spotify.com/artist/1HH5TlkjRt2FG8dpkWNm5j))
2. Copy the artist URL
3. Paste it into TrackMiner
4. Click "Load Music"
5. The artist's most popular tracks will be loaded! 🎤

**Example:**
```
https://open.spotify.com/artist/1HH5TlkjRt2FG8dpkWNm5j
```

## 🔍 Console Output Examples

### **Loading an Album:**
```
=== METADATA FETCH ===
URL: https://open.spotify.com/album/6HNaT9M3f1Pe4B32y3WfOq
Type: spotify-album

💿 Loading Spotify album...
⏱️  Started at: 4:30:15 PM
✅ Loaded Spotify album: "Hannibal" with 33 tracks
⏱️  Completed at: 4:30:18 PM
⏱️  Total time: 2.87s
```

### **Loading an Artist:**
```
=== METADATA FETCH ===
URL: https://open.spotify.com/artist/1HH5TlkjRt2FG8dpkWNm5j
Type: spotify-artist

🎤 Loading Spotify artist...
⏱️  Started at: 4:31:20 PM
✅ Loaded Spotify artist: "ISK" with 10 popular tracks
⏱️  Completed at: 4:31:22 PM
⏱️  Total time: 1.95s
```

## 🛠️ Technical Implementation

### **Backend (server/index.js):**

1. **New URL Detection:**
   - `detectUrlType()` now recognizes `spotify.com/album/` and `spotify.com/artist/`
   - Added `extractSpotifyAlbumId()` and `extractSpotifyArtistId()` helper functions

2. **New Metadata Handlers:**
   - `spotify-album` handler: Fetches all album tracks using `spotdl`
   - `spotify-artist` handler: Fetches artist's popular tracks using `spotdl`

3. **Fast Metadata Fetching:**
   - Uses `fetchSpotifyPlaylistFast()` function (same as playlists)
   - Optimized with 8 threads for quick loading
   - Handles Spotify API rate limiting gracefully

### **Frontend (src/components/PlaylistInput.tsx):**

1. **Updated URL Validation:**
   - Added regex patterns for album and artist URLs
   - Updated error messages to include new types

2. **Updated UI:**
   - Placeholder text now mentions albums and artists
   - Supported URLs list includes 💿 Albums and 🎤 Artists
   - Icons clearly indicate each type

## 📊 Benefits

✅ **Download Full Albums** - Get entire albums with one URL  
✅ **Discover Artist Hits** - Automatically get an artist's most popular tracks  
✅ **Fast Loading** - Same optimized metadata fetching as playlists  
✅ **Consistent Experience** - Works exactly like playlist/track downloads  
✅ **Mix & Match** - Combine albums, artists, playlists, and individual tracks!  

## 🎨 User Experience

### **Album Display:**
- Shows album art
- Displays all tracks in order
- Shows artist name as owner
- Description: "Album · Artist Name"

### **Artist Display:**
- Shows artist's profile image (from first track)
- Displays popular tracks
- Shows artist name as owner
- Description: "Artist · Popular tracks"

## 🔗 Example URLs to Try

### **Albums:**
- ISK - Hannibal: `https://open.spotify.com/album/6HNaT9M3f1Pe4B32y3WfOq`
- Any Spotify album URL works!

### **Artists:**
- ISK: `https://open.spotify.com/artist/1HH5TlkjRt2FG8dpkWNm5j`
- Any Spotify artist URL works!

## 🚀 What Spotdl Does

When you provide an **album URL**, spotdl:
- Fetches all tracks from the album in order
- Preserves album metadata (artwork, artist, album name)
- Downloads in high quality (320kbps)

When you provide an **artist URL**, spotdl:
- Fetches the artist's most popular/top tracks
- Usually returns 10-20 most popular songs
- Perfect for discovering an artist's best work!

## 📝 Notes

- **Artist URLs** return popular tracks, not all discography
- **Album URLs** return all tracks from that specific album
- Both use the same fast metadata fetching as playlists
- Both support mixing with other URL types (playlists, tracks, YouTube)
- Download works exactly the same - select tracks and click download!

## 🎉 Enjoy!

Now you can easily download:
- 🎵 Individual tracks
- 📁 Entire playlists
- 💿 **Full albums** (NEW!)
- 🎤 **Artist's hits** (NEW!)
- 📺 YouTube videos
- 📂 YouTube playlists

All with one URL! 🚀

---

**Powered by spotdl and yt-dlp** 🎶

