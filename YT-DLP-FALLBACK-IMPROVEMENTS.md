# YT-DLP Fallback Improvements

## Overview
Enhanced the yt-dlp fallback mechanism to handle failed spotdl downloads more effectively.

## 🐛 Critical Bug Fix

**The Problem**: The fallback wasn't triggering because the code counted **total files in the folder** (including old downloads) instead of checking which **specific tracks** were downloaded.

**Example**:
- Folder has 14 MP3s from previous downloads
- Trying to download 1 new track
- Old logic: `remaining = 1 - 14 = -13` (negative, so no fallback triggered!)
- New logic: Checks if "Kafon - Mahboula.mp3" exists (it doesn't, so fallback triggers ✅)

## What Was Changed

### 1. **Enhanced Fallback Function** (`tryYtDlpFallback`)
- ✅ Now uses `ytsearch1:` instead of `ytsearch:` for single best match
- ✅ Fixed yt-dlp command syntax: `-x --audio-format mp3` 
- ✅ Can use direct YouTube links captured from spotdl errors
- ✅ Better logging and progress reporting
- ✅ Filename sanitization to prevent issues with special characters

### 2. **YouTube Link Extraction**
- ✅ Added `youtubeLinks` object to store YouTube URLs found by spotdl
- ✅ Modified stderr handler to capture YouTube links from error messages
- ✅ Example: When spotdl fails with "AudioProviderError: YT-DLP download error - https://music.youtube.com/watch?v=iybxD_aILWg", the link is captured
- ✅ Links are matched to tracks for use in fallback

### 3. **Earlier Fallback Trigger**
- ✅ Changed from triggering after 2 attempts to after 1 attempt
- ✅ Faster fallback means less waiting for users

### 4. **Automatic Search Retry**
- ✅ If direct YouTube link fails, automatically retries with `ytsearch1:Artist Song`
- ✅ Prevents getting stuck on region-locked or unavailable direct links
- ✅ Two-stage approach: try direct link first, then search

### 5. **Fixed Track Counting Logic** ⭐ CRITICAL FIX
- ✅ Now checks if **specific tracks** exist by name, not just file count
- ✅ Handles folders with existing downloads correctly
- ✅ Uses `missingTracks.filter()` to identify which tracks need downloading
- ✅ Fallback now triggers even when folder has old files

### 6. **Improved Track Identification**
- ✅ Captures track info from "Processing query:" output
- ✅ Smart fallback: if single track download, automatically links YouTube URL
- ✅ For multi-track downloads, assigns to first unlinked track
- ✅ Better logging shows which track is being processed

## How It Works

### Stage 1: spotdl (First Attempt)
```
spotdl download <track_url> --output ... --format mp3 --bitrate 320k
```
- If fails, captures YouTube link from error message

### Stage 2: yt-dlp with Direct Link (After First Failure)
```
yt-dlp -x --audio-format mp3 --audio-quality 320K --no-playlist <youtube_link>
```
- Uses the YouTube link that spotdl found but couldn't download

### Stage 3: yt-dlp with Search (If Direct Link Fails)
```
yt-dlp "ytsearch1:Artist Song" -x --audio-format mp3 --audio-quality 320K
```
- Searches YouTube for best match if direct link doesn't work

## Example Flow

For track "Kafon - Mahboula":

1. **spotdl attempt**: FAILS with error containing `https://music.youtube.com/watch?v=iybxD_aILWg`
2. **yt-dlp direct link**: Try `yt-dlp -x --audio-format mp3 https://music.youtube.com/watch?v=iybxD_aILWg`
3. **yt-dlp search** (if step 2 fails): `yt-dlp "ytsearch1:Kafon Mahboula" -x --audio-format mp3`

## Benefits

- ✅ **3-stage download strategy** ensures maximum success rate
- ✅ **Faster fallback** (triggers after 1st attempt instead of 2nd)
- ✅ **Uses spotdl's YouTube link** when available
- ✅ **Automatic search fallback** if direct link fails
- ✅ **Better error handling** and user feedback
- ✅ **Region-lock resilient** by trying search if direct link blocked

## Testing

Try downloading tracks that previously failed. You should see:
1. spotdl attempt with error message
2. "🔄 TRYING YT-DLP FALLBACK" message
3. Either direct link download or search-based download
4. Success message: "✅ Downloaded via yt-dlp"

## Expected Console Output

**Before (BROKEN - fallback didn't trigger):**
```
Total files in folder: 14
Expected tracks: 1
FINAL RESULT: 🎉 All 14 tracks downloaded successfully!  ❌ WRONG!
```

**After (FIXED - fallback works):**
```
🎯 Processing: Kafon - Mahboula
  📝 Captured YouTube link for fallback: https://music.youtube.com/watch?v=iybxD_aILWg
  ✓ Linked YouTube URL to track: Kafon - Mahboula

Downloaded this round: 0
Missing tracks: 1

🔄 TRYING YT-DLP FALLBACK for 1 failed tracks...
🔄 Trying yt-dlp for: Kafon Mahboula
  Using YouTube link from spotdl: https://music.youtube.com/watch?v=iybxD_aILWg
✅ yt-dlp SUCCESS: Kafon Mahboula

🎉 All 1 tracks downloaded successfully! (with yt-dlp fallback)
```

## Files Modified

- ✅ `server/index.js` - Complete rewrite of download logic with 3-stage fallback
  - Fixed track counting (checks specific tracks, not total files)
  - Captures YouTube links from spotdl errors
  - Triggers yt-dlp fallback after first failure
  - Auto-retry with search if direct link fails
  - Improved logging and track identification

