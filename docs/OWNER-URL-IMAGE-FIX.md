# 🔧 Owner URL & Owner Image Fix

## 🎯 Problem

When loading Spotify playlists, the owner URL and owner image were empty:

```
Extracted from Spotify page:
  Owner: achraf guemati  ✅
  Owner URL:             ❌ (empty)
  Owner Image:           ❌ (empty)
```

## ✅ Solution

I've implemented a **multi-tier fallback system** to extract owner information from various sources!

### **1. Enhanced NEXT_DATA Extraction**

Now properly extracts owner info from `window.__NEXT_DATA__` with better logging:

```javascript
const owner = nextData?.props?.pageProps?.state?.data?.entity?.owner;
if (owner?.uri) {
  ownerUrl = owner.uri.replace('spotify:user:', 'https://open.spotify.com/user/');
}
if (owner?.images && owner.images[0]?.url) {
  ownerImage = owner.images[0].url;
}
```

### **2. Embed Page JSON Extraction**

If NEXT_DATA fails, tries to extract from embed page JSON:

```javascript
const embedDataMatch = embedHtml.match(/window\.__SPOTIFY_INITIAL_STATE__\s*=\s*({.+?});/s);
// Extracts owner data from multiple possible paths
```

### **3. Spotdl Metadata Fallback**

When web scraping fails and spotdl is used, extracts from `list_url`:

```javascript
if (firstSong.list_url) {
  const userMatch = firstSong.list_url.match(/user\/([^\/\?]+)/);
  if (userMatch) {
    ownerUrl = `https://open.spotify.com/user/${userMatch[1]}`;
  }
}
```

### **4. Search URL Fallback**

If all else fails, creates a Spotify search URL:

```javascript
if (!ownerUrl) {
  const encodedOwner = encodeURIComponent(playlistOwner);
  ownerUrl = `https://open.spotify.com/search/${encodedOwner}`;
}
```

### **5. Default Avatar**

Uses Spotify's default user avatar if no image found:

```javascript
if (!ownerImage) {
  ownerImage = 'https://i.scdn.co/image/ab6775700000ee85b36c6d0ad0e5395c4f3d5df4';
}
```

## 🚀 How to Use

### **1. Restart the Server**

**Important:** Restart for the changes to take effect!

```batch
restart-all.bat
```

### **2. Test with Your Playlist**

Load any Spotify playlist, for example:
```
https://open.spotify.com/playlist/4d4OE8ztHCPdL34WKrFIDZ
```

## 📊 Expected Console Output

### **Best Case (Full Extraction):**

```
✅ Owner name from NEXT_DATA: achraf guemati
✅ Owner URL from NEXT_DATA: https://open.spotify.com/user/abc123xyz
✅ Owner image from NEXT_DATA: https://i.scdn.co/image/ab67757000...

Extracted from Spotify page:
  Owner: achraf guemati
  Owner URL: https://open.spotify.com/user/abc123xyz
  Owner Image: https://i.scdn.co/image/ab67757000...
  Playlist Image: https://image-cdn-ak.spotifycdn.com/...
```

### **Fallback Case (Constructed URLs):**

```
Final owner: achraf guemati
✅ Constructed owner URL from list_url: https://open.spotify.com/user/abc123xyz
✅ Using default Spotify user avatar
Final owner URL: https://open.spotify.com/user/abc123xyz
Final owner image: https://i.scdn.co/image/ab6775700000ee85...
```

### **Worst Case (Search URL):**

```
Final owner: achraf guemati
✅ Created search URL for owner: https://open.spotify.com/search/achraf%20guemati
✅ Using default Spotify user avatar
Final owner URL: https://open.spotify.com/search/achraf%20guemati
Final owner image: https://i.scdn.co/image/ab6775700000ee85...
```

## 🎨 UI Display

### **With Owner URL:**
Clicking the owner name will open their Spotify profile (or search page)

### **With Owner Image:**
Shows the user's profile picture (or default Spotify avatar)

## 🔍 Extraction Priority

The system tries in this order:

1. **NEXT_DATA** (Main page JSON)
   - `window.__NEXT_DATA__` → owner info
   
2. **Embed Page JSON** (If #1 fails)
   - `window.__SPOTIFY_INITIAL_STATE__` → owner info
   
3. **Spotdl Metadata** (If web scraping fails completely)
   - `list_url` → extract user ID
   
4. **Constructed URLs** (Last resort)
   - Search URL from owner name
   - Default Spotify avatar

## 📝 Data Sources

### **Owner URL Sources:**

| Priority | Source | Example |
|----------|--------|---------|
| 1 | NEXT_DATA uri | `spotify:user:abc123` → `https://open.spotify.com/user/abc123` |
| 2 | Embed JSON | Same as above |
| 3 | Spotdl list_url | Extract from `https://open.spotify.com/playlist/.../user/abc123` |
| 4 | Search URL | `https://open.spotify.com/search/username` |

### **Owner Image Sources:**

| Priority | Source | Example |
|----------|--------|---------|
| 1 | NEXT_DATA images | User's actual profile picture |
| 2 | Embed JSON | User's actual profile picture |
| 3 | Default Avatar | Spotify's default user icon |

## ✨ Benefits

✅ **Always have owner URL** - Either real profile or search link  
✅ **Always have owner image** - Either real photo or default avatar  
✅ **Better UX** - Clickable owner names, visible avatars  
✅ **Fallback chain** - Multiple extraction methods ensure success  
✅ **Detailed logging** - See exactly where data comes from  

## 🎯 Example Output

For playlist: `Mahboula` by `achraf guemati`

**Before Fix:**
```json
{
  "owner": "achraf guemati",
  "ownerUrl": "",
  "ownerImage": ""
}
```

**After Fix:**
```json
{
  "owner": "achraf guemati",
  "ownerUrl": "https://open.spotify.com/user/abc123xyz",
  "ownerImage": "https://i.scdn.co/image/ab6775700000ee85..."
}
```

## 🔧 Technical Details

### **Extraction Function Locations:**

1. **Main Scraping:** Lines 954-1025
   - Tries NEXT_DATA and embed page
   
2. **Spotdl Fallback:** Lines 1285-1312
   - Constructs URLs from metadata
   - Applies default values

### **Key Changes:**

- ✅ Better JSON parsing with multiple paths
- ✅ Explicit logging for each extraction attempt
- ✅ Smart URL construction from list_url
- ✅ Default avatar fallback
- ✅ Search URL as last resort

## 🚀 Ready to Test!

1. **Restart server** (`restart-all.bat`)
2. **Load a playlist**
3. **Check console** - You'll see exactly where each piece of data comes from
4. **Check UI** - Owner info should be complete!

---

**Now you'll always have owner URL and image! 🎉**

