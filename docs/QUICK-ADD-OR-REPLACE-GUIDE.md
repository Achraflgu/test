# ⚡ Quick Guide: Add or Replace Feature

## What You Get

A **professional confirmation dialog** when loading new music while you already have tracks loaded!

## Visual Preview

### When You Try to Load New Music

```
╔═══════════════════════════════════════════════╗
║  🎵  Add or Replace Music?                    ║
╠═══════════════════════════════════════════════╣
║                                                ║
║  You already have "Today's Top Hits" loaded.  ║
║                                                ║
║  What would you like to do with the new       ║
║  music (1 track)?                             ║
║                                                ║
╠═══════════════════════════════════════════════╣
║                                                ║
║  [Cancel] [🔄 Clear & Load New] [➕ Add to Existing] ║
║                                                ║
╚═══════════════════════════════════════════════╝
```

## 3 Simple Options

### ➕ Add to Existing (Recommended for building playlists)

**Before:**
```
Playlist: "Today's Top Hits"
Tracks: 50
```

**After:**
```
Playlist: "Today's Top Hits + كبرنا بأسامينا"
Tracks: 51 ✅ (all tracks combined)
```

### 🔄 Clear & Load New (Replace everything)

**Before:**
```
Playlist: "Today's Top Hits"
Tracks: 50
```

**After:**
```
Playlist: "كبرنا بأسامينا"
Tracks: 1 (only the new track)
```

### ❌ Cancel (Keep what you have)

**Result:**
```
Nothing changes - existing playlist stays as is
```

## Power User Tip: Build Mega Playlists! 🚀

```
Load 1: Spotify Playlist "Chill Vibes" (30 tracks)
        ↓
Load 2: YouTube Playlist "Lo-Fi Beats" (20 tracks)
        → Dialog → Click "Add to Existing"
        ↓
Load 3: Single Spotify Track "Perfect Song" (1 track)
        → Dialog → Click "Add to Existing"
        ↓
Result: "Chill Vibes + Lo-Fi Beats + Perfect Song" (51 tracks!)

Download all 51 together! 🎉
```

## Smart Playlist Naming

The app automatically creates combined names:

```
"Workout Mix" + "Pump Up" = "Workout Mix + Pump Up"
"Workout Mix + Pump Up" + "Eye of the Tiger" = "Workout Mix + Pump Up + Eye of the Tiger"
```

## Files Changed

- ✅ `src/components/PlaylistInput.tsx` - Dialog & logic
- ✅ `src/pages/Index.tsx` - Merge handling
- ✅ No breaking changes - fully backward compatible

## Testing

```bash
# Test 1: First Load (No Dialog)
1. Paste URL → Click "Load Music"
2. Should load directly ✅

# Test 2: Second Load (Dialog Appears)
1. Paste another URL → Click "Load Music"
2. Dialog appears! ✅
3. Choose an option

# Test 3: Add Multiple
1. Keep loading and clicking "Add to Existing"
2. Name updates: "A + B + C + D..."
3. All tracks in one list! ✅
```

## Status

✅ Feature Complete  
✅ Professional Design  
✅ No Linter Errors  
✅ Ready to Use!  

**Try it now!** Load some music and see the magic happen! ✨

