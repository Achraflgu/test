# Example: Loading Single Spotify Track

## Your Example

### URL
```
https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP?si=04a9dfc9ea994d8a
```

### Track Info (from [Spotify page](https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP))

**Song**: كبرنا بأسامينا (Kabarna bi Asamina)  
**Artists**: Dekka, Klay BBJ, Blingos  
**Album**: كبرنا بأسامينا  
**Release**: 2025  
**Duration**: 4:03 (243 seconds)  
**Label**: No Cap Music Records  

## What Happens When You Load It

### Step 1: Paste URL
```
Paste in the app: https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP
```

### Step 2: System Detects Type
```bash
=== METADATA FETCH ===
URL: https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP?si=04a9dfc9ea994d8a
Type: spotify-track  ✅ Detected as single track
```

### Step 3: Fast Web Scraping
```bash
🎵 Loading single Spotify track...
🎵 Fetching single Spotify track...
Scraping: https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP
Extracting: window.__NEXT_DATA__
```

### Step 4: Metadata Extracted
```bash
✅ Loaded single track: "كبرنا بأسامينا" by Dekka, Klay BBJ, Blingos

Playlist (Single Track):
  Name: كبرنا بأسامينا
  Description: Single track by Dekka, Klay BBJ, Blingos
  Owner: Dekka, Klay BBJ, Blingos
  Total Tracks: 1
  Duration: 243 seconds (4:03)
  Cover: https://i.scdn.co/image/ab67616d0000b273...

Track Details:
  ID: 4GOGIk5a8CAw3ehqmdVIaP
  Name: كبرنا بأسامينا
  Artist: Dekka, Klay BBJ, Blingos
  Album: كبرنا بأسامينا
  Duration: 243 seconds
  URL: https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP
  Status: Ready to download ✅
```

### Step 5: Ready to Download
```
Track appears in the UI
You can click "Download" to save it as MP3
```

## Download Process

When you click Download:

### Method 1: spotdl (Primary)
```bash
python -m spotdl download https://open.spotify.com/track/4GOGIk5a8CAw3ehqmdVIaP \
  --output "Downloads/Dekka, Klay BBJ, Blingos - كبرنا بأسامينا.mp3" \
  --format mp3 \
  --bitrate 320k
```

### Method 2: yt-dlp (Fallback)
If spotdl fails:
```bash
# 1. Fetch metadata
yt-dlp "ytsearch1:Dekka Klay BBJ Blingos كبرنا بأسامينا" \
  --get-title --get-id --get-thumbnail

# 2. Download
yt-dlp "ytsearch1:Dekka Klay BBJ Blingos كبرنا بأسامينا" \
  -x --audio-format mp3 --audio-quality 320K \
  --embed-thumbnail --embed-metadata \
  --parse-metadata "artist:Dekka, Klay BBJ, Blingos" \
  --parse-metadata "title:كبرنا بأسامينا" \
  --parse-metadata "album:كبرنا بأسامينا"
```

## Final MP3 File

**Filename**: `Dekka, Klay BBJ, Blingos - كبرنا بأسامينا.mp3`

**ID3 Tags**:
```
Title: كبرنا بأسامينا
Artist: Dekka, Klay BBJ, Blingos
Album: كبرنا بأسامينا
Year: 2025
Duration: 4:03
Bitrate: 320kbps
Cover Art: Embedded ✅
```

## Speed Comparison

| Method | Load Time | Download Time |
|--------|-----------|---------------|
| **Old** (No single track support) | ❌ Not supported | ❌ |
| **New** (Web scraping) | ⚡ 1-2 seconds | 🎵 ~5-10 seconds |

## Try More Spotify Tracks

From the same artists:

### Dekka
```
https://open.spotify.com/track/... (Needed You)
https://open.spotify.com/track/... (234)
https://open.spotify.com/track/... (Dead Back 2)
```

### Klay BBJ
```
https://open.spotify.com/track/... (Qarar)
https://open.spotify.com/track/... (Darjin)
https://open.spotify.com/track/... (3la Moulena)
```

### Related Tracks
```
https://open.spotify.com/track/... (Galbi safi / قلبي صافي - MarCo)
https://open.spotify.com/track/... (مفيش مبداء - Xoureldin)
https://open.spotify.com/track/... (TACHMA - NVST)
```

## Benefits

✅ **Single track download** - No need to load entire album  
✅ **Instant metadata** - 1-2 seconds to load  
✅ **No downloads during load** - Only fetches info  
✅ **Works with Arabic text** - Proper Unicode support  
✅ **High quality artwork** - Spotify cover art embedded  
✅ **Proper ID3 tags** - Ready for music players  

---

**Try it now!** Just paste the Spotify track URL and see it load instantly! 🎉

