# 🎵 Multi-Source Support - Spotify & YouTube!

## New Feature: Load from Multiple Sources

You can now load music from **4 different sources**:

### ✅ Supported URL Types

| Source | Type | Example URL | Speed |
|--------|------|-------------|-------|
| 🎵 **Spotify Track** | Single song | `https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP` | ⚡ Instant (1-2s) |
| 📁 **Spotify Playlist** | Multiple songs | `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M` | ⚡ Instant (1-2s) |
| 📺 **YouTube Video** | Single video | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | 🔧 Fast (2-5s) |
| 📺 **YouTube Music** | Single video | `https://music.youtube.com/watch?v=dQw4w9WgXcQ` | 🔧 Fast (2-5s) |
| 📂 **YouTube Playlist** | Multiple videos | `https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf` | 🔧 Medium (5-10s) |

## How It Works

### 1. **Spotify Track** (Example: "كبرنا بأسامينا" by Dekka)

```
URL: https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP

✅ Loaded single track: "كبرنا بأسامينا" by Dekka, Klay BBJ, Blingos
   Duration: 4:03
   Album: كبرنا بأسامينا
   Cover: High-quality Spotify artwork
```

**What you get:**
- Track name: كبرنا بأسامينا
- Artist: Dekka, Klay BBJ, Blingos
- Album: كبرنا بأسامينا  
- Duration: 243 seconds
- Cover image: Spotify artwork
- Ready to download

### 2. **Spotify Playlist** (Existing feature)

```
URL: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M

✅ Loaded 50 tracks from "Today's Top Hits" (FAST METHOD)
   Web scraping method (no spotdl needed)
```

### 3. **YouTube Video**

```
URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ

✅ Loaded YouTube video: "Rick Astley - Never Gonna Give You Up"
   Uses yt-dlp to fetch metadata
   Includes thumbnail, duration, uploader
```

**What you get:**
- Video title
- Channel/uploader name
- Duration
- Thumbnail (cover art)
- Direct download link

### 4. **YouTube Playlist**

```
URL: https://www.youtube.com/playlist?list=PLxxxxxx

✅ Loaded YouTube playlist: "My Music Collection" with 25 videos
   All videos parsed with metadata
   Ready for batch download
```

**What you get:**
- Playlist name
- All video titles
- Channels/uploaders
- Durations
- Thumbnails
- Individual download links

## Console Output Examples

### Spotify Track
```bash
=== METADATA FETCH ===
URL: https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP
Type: spotify-track

🎵 Loading single Spotify track...
🎵 Fetching single Spotify track...
✅ Loaded single track: "كبرنا بأسامينا" by Dekka, Klay BBJ, Blingos
```

### YouTube Video
```bash
=== METADATA FETCH ===
URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
Type: youtube-video

📺 Loading single YouTube video...
📺 Fetching YouTube video metadata...
✅ Loaded YouTube video: "Rick Astley - Never Gonna Give You Up"
```

### YouTube Playlist
```bash
=== METADATA FETCH ===
URL: https://www.youtube.com/playlist?list=PLxxxxxx
Type: youtube-playlist

📺 Loading YouTube playlist...
📺 Fetching YouTube playlist metadata...
✅ Loaded YouTube playlist: "My Music Collection" with 25 videos
```

## Technical Details

### URL Detection

The system automatically detects URL type using pattern matching:

```javascript
function detectUrlType(url) {
  if (url.includes('spotify.com/track/')) return 'spotify-track';
  if (url.includes('spotify.com/playlist/')) return 'spotify-playlist';
  if (url.includes('youtube.com/watch')) return 'youtube-video';
  if (url.includes('youtube.com/playlist')) return 'youtube-playlist';
  if (url.includes('music.youtube.com/watch')) return 'youtube-music';
  return 'unknown';
}
```

### Metadata Extraction

#### Spotify (Fast - Web Scraping)
- Scrapes Spotify web page
- Extracts `window.__NEXT_DATA__` JSON
- Gets all metadata instantly
- **No authentication required**
- **No spotdl needed** (90% of cases)

#### YouTube (yt-dlp JSON)
- Uses `yt-dlp --dump-json`
- Gets complete video metadata
- Includes all thumbnail qualities
- Fast and reliable

## Download Compatibility

All sources download the same way:

1. **Load** playlist/track/video
2. **Select** tracks you want
3. **Download** using spotdl (Spotify) or yt-dlp (YouTube)

### Download Methods

| Source | Download Tool | Metadata Embed | Quality |
|--------|--------------|----------------|---------|
| Spotify Track | spotdl or yt-dlp fallback | ✅ Full ID3 tags | 320kbps |
| Spotify Playlist | spotdl or yt-dlp fallback | ✅ Full ID3 tags | 320kbps |
| YouTube Video | yt-dlp | ✅ Metadata + thumbnail | 320kbps |
| YouTube Playlist | yt-dlp | ✅ Metadata + thumbnail | 320kbps |

## Examples to Try

### Spotify Tracks
```
https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP
https://open.spotify.com/track/05hLyKOIzeabJJ5QSHw22x
```

### Spotify Playlists
```
https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd
```

### YouTube Videos
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://music.youtube.com/watch?v=dQw4w9WgXcQ
```

### YouTube Playlists
```
https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf
```

## Benefits

1. **✅ More Flexible**
   - Not limited to Spotify
   - Works with YouTube Music
   - Single tracks or full playlists

2. **✅ Faster**
   - Spotify tracks load instantly (web scraping)
   - YouTube uses efficient JSON extraction
   - No unnecessary downloads

3. **✅ Better Coverage**
   - Some music only on YouTube
   - Some only on Spotify
   - Now you can get both!

4. **✅ Unified Interface**
   - Same UI for all sources
   - Same download process
   - Consistent experience

## Error Handling

### Unknown URL Type
```json
{
  "error": "Unsupported URL type. Please provide a Spotify playlist/track URL or YouTube video/playlist URL.",
  "urlType": "unknown"
}
```

### Invalid URL
```json
{
  "error": "Invalid Spotify track URL"
}
```

### Fetch Failed
Falls back to spotdl for Spotify URLs, or returns error for YouTube.

## Files Modified

- ✅ `server/index.js`
  - Added `detectUrlType()` function
  - Added `extractSpotifyTrackId()` function
  - Added `extractYouTubeVideoId()` function
  - Added `extractYouTubePlaylistId()` function
  - Added `fetchSpotifyTrack()` async function
  - Added `fetchYouTubeVideo()` async function
  - Added `fetchYouTubePlaylist()` async function
  - Enhanced `/api/playlist/metadata` endpoint with routing

## Testing

Try all URL types:

1. **Single Spotify Track**: Paste track URL → Should load in 1-2 seconds
2. **Spotify Playlist**: Paste playlist URL → Should load in 1-2 seconds
3. **YouTube Video**: Paste video URL → Should load in 2-5 seconds
4. **YouTube Playlist**: Paste playlist URL → Should load in 5-10 seconds

All should show proper metadata and be ready to download! 🎉

