# 🎵 YouTube Metadata Embedding Enhancement

## Overview
Enhanced yt-dlp fallback to fetch and embed full YouTube metadata into MP3 files, including thumbnails and ID3 tags.

## Features Added

### 1. **Pre-Download Metadata Fetching**
Before downloading, the system now fetches:
- 📺 **YouTube Title** - The actual video title
- 🆔 **Video ID** - YouTube video identifier
- 🖼️ **Thumbnail URL** - Album artwork image URL
- 🔗 **Direct URL** - Full YouTube watch URL

### 2. **Metadata Embedding in MP3**
All downloads now include:
- ✅ **`--embed-thumbnail`** - Downloads and embeds album artwork into MP3
- ✅ **`--embed-metadata`** - Embeds video metadata (title, uploader, etc.)
- ✅ **`--add-metadata`** - Adds ID3 tags for proper music player recognition
- ✅ **`--parse-metadata`** - Maps Spotify metadata to MP3 tags:
  - Artist name from Spotify
  - Track title from Spotify
  - Album name from Spotify (or "YouTube" if unavailable)

## Example Console Output

When downloading "Kafon - Mahboula", you'll now see:

```
🔄 Trying yt-dlp for: Kafon Mahboula
  📊 Fetching YouTube metadata...
  📺 YouTube Title: Kafon - Mahboula [Official Audio]
  🆔 Video ID: KoDjUCejxoA
  🖼️  Thumbnail: https://i.ytimg.com/vi/KoDjUCejxoA/maxresdefault.jpg
  🔗 URL: https://www.youtube.com/watch?v=KoDjUCejxoA
  
  Searching YouTube: "ytsearch1:Kafon Mahboula"
  yt-dlp: [download] Destination: C:\Users\...\Kafon - Mahboula.webm
  yt-dlp: [download] 100% of 3.13MiB in 00:00:01
  yt-dlp: [ExtractAudio] Destination: C:\Users\...\Kafon - Mahboula.mp3
✅ yt-dlp SUCCESS: Kafon Mahboula
```

## Command Examples

### Fetch Metadata Only (No Download)
```bash
yt-dlp "ytsearch1:Kafon Mahboula" --get-url --get-title --get-id --get-thumbnail
```

**Output:**
```
https://www.youtube.com/watch?v=KoDjUCejxoA
Kafon - Mahboula [Official Audio]
KoDjUCejxoA
https://i.ytimg.com/vi/KoDjUCejxoA/maxresdefault.jpg
```

### Download with Full Metadata (What We Do)
```bash
yt-dlp "ytsearch1:Kafon Mahboula" \
  -x --audio-format mp3 --audio-quality 320K \
  --embed-thumbnail \
  --embed-metadata \
  --add-metadata \
  --parse-metadata "artist:Kafon" \
  --parse-metadata "title:Mahboula" \
  --parse-metadata "album:Mahboula" \
  --output "Kafon - Mahboula.%(ext)s"
```

## What Gets Embedded in the MP3

Your downloaded MP3 files now include:

### ID3 Tags
- **Artist**: From Spotify metadata (e.g., "Kafon")
- **Title**: From Spotify metadata (e.g., "Mahboula")
- **Album**: From Spotify metadata (e.g., "Mahboula")
- **YouTube URL**: In comments/metadata
- **Uploader**: YouTube channel name

### Album Artwork
- Downloaded from YouTube thumbnail (highest quality available)
- Embedded as cover art in MP3
- Visible in music players (Windows Media Player, VLC, iTunes, etc.)

## Benefits

✅ **Proper Music Player Display**
- Shows correct artist, title, album in your music library
- Displays album artwork/thumbnail
- Organized metadata for playlists

✅ **No Manual Tagging Needed**
- All metadata is automatically embedded
- No need to use external ID3 tag editors

✅ **Better Organization**
- Files are properly tagged for music management software
- Search works correctly in music apps
- Playlists organize properly

## Technical Details

### Metadata Flow

1. **Fetch Phase** (using `--get-*` flags):
   ```javascript
   const metadata = await fetchYouTubeMetadata(searchQuery, youtubeLink);
   // Returns: { title, videoId, thumbnail }
   ```

2. **Download Phase** (with embedding flags):
   ```javascript
   ytdlpArgs = [
     '-m', 'yt_dlp',
     'ytsearch1:Artist Song',
     '-x', '--audio-format', 'mp3',
     '--embed-thumbnail',      // Embeds album art
     '--embed-metadata',       // Embeds YT metadata
     '--add-metadata',         // Adds ID3 tags
     '--parse-metadata', 'artist:ArtistName',
     '--parse-metadata', 'title:TrackName',
     '--parse-metadata', 'album:AlbumName'
   ]
   ```

3. **Result**:
   - MP3 file with complete ID3 tags
   - Embedded album artwork from YouTube thumbnail
   - All Spotify metadata preserved

## Files Modified

- ✅ `server/index.js`
  - Added `fetchYouTubeMetadata()` function
  - Enhanced `tryYtDlpFallback()` with metadata embedding
  - Logs metadata before downloading
  - Embeds metadata during download

## Testing

Try the same track again:
```
Track: Kafon - Mahboula
```

**You'll see:**
1. Metadata fetch logs (title, ID, thumbnail, URL)
2. Download with embedded metadata
3. MP3 file with proper tags and artwork

**Verify the result:**
- Right-click MP3 → Properties → Details
- Should show: Artist, Title, Album, and thumbnail

