# 🧪 Test the New Frontend - Quick Guide

## 🚀 Start the App

```bash
# Terminal 1: Start backend
cd server
node index.js

# Terminal 2: Start frontend
npm run dev
```

Or use the batch files:
```bash
start-all.bat
```

---

## ✅ Visual Tests (Instant)

### 1. **Check Browser Tab**
- [ ] Tab shows new favicon (music note with gradient)
- [ ] Title: "TrackMiner - Multi-Source Music Downloader"

### 2. **Check Homepage Header**
- [ ] Badge says "Spotify & YouTube Support" (gradient text)
- [ ] Title says "**TrackMiner**" (gradient: green → red)
- [ ] Subtitle: "Multi-Source Downloader"
- [ ] Description mentions both Spotify & YouTube

### 3. **Check Feature Pills**
- [ ] Green pill: "Spotify Tracks & Playlists"
- [ ] Red pill: "YouTube Videos & Playlists"
- [ ] Primary pill: "320kbps Quality"

### 4. **Check Empty State**
- [ ] Says "Ready to Mine Some Tracks?"
- [ ] Mentions "Spotify or YouTube URL"

### 5. **Check Input Field**
- [ ] Placeholder: "Enter Music URL"
- [ ] Button: "Load Music"
- [ ] Pro Tip lists all supported URL types

---

## 🎵 Functional Tests

### Test 1: Load Spotify Playlist
```
1. Paste: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
2. Click "Load Music"
3. Wait for tracks to load
4. ✅ Should load successfully
```

### Test 2: Load YouTube Video
```
1. Paste: https://www.youtube.com/watch?v=dQw4w9WgXcQ
2. Click "Load Music"
3. ✅ Should load as single track
```

### Test 3: Load YouTube Playlist
```
1. Paste: https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf
2. Click "Load Music"
3. ✅ Should load all videos
```

---

## 🔔 Notification Tests

### Test 4: Tab Title Updates
```
1. Load any playlist/track
2. Select 1-3 tracks
3. Click "Download Selected Tracks"
4. WATCH THE BROWSER TAB:
   ✅ Should show: "⏬ 0/3 (0%) - TrackMiner"
   ✅ Updates to: "⏬ 1/3 (33%) - TrackMiner"
   ✅ Updates to: "⏬ 2/3 (67%) - TrackMiner"
   ✅ Updates to: "⏬ 3/3 (100%) - TrackMiner"
```

### Test 5: Success Notification
```
1. Download 1 track (easy to test)
2. When complete, WATCH:
   ✅ Tab title BLINKS: "🎉 1 track downloaded!"
   ✅ Alternates with: "TrackMiner - Multi-Source..."
   ✅ Blinks ~3 times (6 seconds total)
   ✅ Hear success beep sound (if volume on)
```

### Test 6: Desktop Notification (if permitted)
```
1. Allow notifications when prompted (or check browser settings)
2. Download tracks
3. Switch to another tab/window
4. When complete:
   ✅ Desktop notification appears: "🎉 Download Complete!"
   ✅ Shows track count and playlist name
```

### Test 7: Background Download
```
1. Start downloading 5+ tracks
2. Switch to ANOTHER TAB (e.g., YouTube)
3. WATCH TrackMiner tab:
   ✅ Tab title should update: "⏬ 3/5 (60%)"
   ✅ When done, tab BLINKS to grab your attention
   ✅ Desktop notification appears
```

---

## 🎨 Gradient Tests

### Test 8: Visual Gradients
```
Check these elements have gradients:

✅ Header badge: "Spotify & YouTube Support" (green → red text)
✅ Title "TrackMiner" (green → red text)
✅ Favicon (green → red background)
✅ Feature pills (green/red tinted backgrounds)
```

---

## 🔊 Sound Tests

### Test 9: Success Sound
```
1. Ensure computer volume is on
2. Download 1 track successfully
3. ✅ Should hear pleasant beep (800Hz, short)
```

### Test 10: Error Sound (Optional)
```
1. Try downloading a track that fails
2. ✅ Should hear alert beep (400Hz, short)
```

---

## 📱 Add/Replace Test

### Test 11: Add to Existing
```
1. Load a Spotify playlist (e.g., 10 tracks)
2. Load ANOTHER playlist (e.g., 5 tracks)
3. Dialog appears: "Add to existing" or "Clear and load new"
4. Click "Add to Existing"
5. ✅ Should show 15 tracks total
6. ✅ Playlist name: "Playlist A + Playlist B"
7. ✅ Track list updates immediately
```

### Test 12: Replace Existing
```
1. Load a Spotify playlist
2. Load a YouTube video
3. Click "Clear and Load New"
4. ✅ Old playlist clears
5. ✅ New track loads
6. ✅ Track list updates immediately
```

---

## 🚨 Edge Case Tests

### Test 13: Failed Track
```
1. Load a playlist with at least one problematic track
2. Download all
3. When a track fails:
   ✅ Toast shows error
   ✅ Track marked as "failed" (red)
   ✅ On complete: "❌ X tracks failed" (blinks)
   ✅ "Show Fallback" button appears
```

### Test 14: Permission Denied
```
1. Block notifications in browser settings
2. Download tracks
3. ✅ Still works (graceful degradation)
4. ✅ No desktop notification
5. ✅ Tab title still updates
6. ✅ Sound still plays
```

### Test 15: Multiple Downloads
```
1. Download 3 tracks
2. While downloading, try to download more
3. ✅ Should disable button
4. ✅ Shows "Downloading..." state
```

---

## 🎯 Quick Visual Checklist

Open the app and visually confirm:

**Header Section:**
- [ ] Badge: "Spotify & YouTube Support" (gradient)
- [ ] Logo icon: Music note (gradient background)
- [ ] Title: "**TrackMiner**" (gradient)
- [ ] Description mentions both platforms

**Feature Pills:**
- [ ] Green pill (Spotify)
- [ ] Red pill (YouTube)
- [ ] Primary pill (320kbps)

**Input Section:**
- [ ] Label: "Enter Music URL"
- [ ] Placeholder: "Spotify or YouTube URL..."
- [ ] Button: "Load Music"
- [ ] Pro Tip: Lists 4 URL types

**Browser Tab:**
- [ ] New favicon visible
- [ ] Title: "TrackMiner - Multi-Source Music Downloader"

---

## 🎬 Watch This Happen

### Full Download Flow (Watch Carefully!)

```
1. Load playlist → "TrackMiner - Multi-Source..."
2. Click download → "⏬ 0/10 (0%) - TrackMiner"
3. Track 1 done → "⏬ 1/10 (10%) - TrackMiner"
   Toast: "✅ Downloaded: Artist - Track"
4. Track 5 done → "⏬ 5/10 (50%) - TrackMiner"
5. All done → [BLINKS]
   "🎉 10 tracks downloaded!" 
   ↔️ 
   "TrackMiner - Multi-Source..."
   ↔️
   "🎉 10 tracks downloaded!"
   ↔️
   "TrackMiner - Multi-Source..."
   ↔️
   "🎉 10 tracks downloaded!"
   ↔️
   "TrackMiner - Multi-Source..." (stays)
6. Desktop: "🎉 Download Complete! From: Playlist Name"
7. Sound: 🔊 *beep*
8. Toast: "🎉 All 10 tracks downloaded successfully!"
```

---

## 🐛 Common Issues & Solutions

### Favicon Not Showing
```
Solution: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
```

### Notifications Not Working
```
Solution: 
1. Check browser permissions
2. Allow notifications for localhost
3. Look for permission prompt on first load
```

### Sound Not Playing
```
Solution:
1. Check computer volume
2. Unmute browser tab
3. Some browsers block autoplay audio
   → Click anywhere on page first
```

### Gradients Not Showing
```
Solution:
1. Check browser supports CSS gradients (modern browsers)
2. Hard refresh (Ctrl+Shift+R)
3. Clear browser cache
```

---

## 📊 Expected Results Summary

| Feature | Expected Result |
|---------|----------------|
| Favicon | 🎵 Music note with gradient |
| Title | "TrackMiner - Multi-Source..." |
| Header | Gradient "TrackMiner" title |
| Pills | Green (Spotify) + Red (YouTube) |
| Input | "Enter Music URL" |
| Progress | Tab shows "⏬ X/Y (Z%)" |
| Success | Tab blinks "🎉", sound plays |
| Desktop | Notification if permitted |
| Error | Tab blinks "❌", alert sound |

---

## 🎉 Success Criteria

Your frontend is working perfectly if:

✅ **Visual**
- New favicon shows in tab
- "TrackMiner" branding everywhere
- Green (Spotify) + Red (YouTube) colors
- Gradient effects visible

✅ **Functional**
- Loads Spotify playlists/tracks
- Loads YouTube videos/playlists
- Add/Replace dialog works
- Downloads work as before

✅ **Notifications**
- Tab title updates during download
- Tab title blinks on success
- Success sound plays
- Desktop notification (if permitted)

---

## 🚀 Next Steps

If all tests pass:
1. ✅ Frontend upgrade is complete!
2. 🎨 Enjoy the new professional design
3. 🔔 Experience Telegram-like notifications
4. 🎵 Download from Spotify & YouTube seamlessly

**TrackMiner is ready to mine tracks!** ⛏️🎵

