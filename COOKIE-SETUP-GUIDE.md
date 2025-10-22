# 🍪 Quick Cookie Setup Guide

## ⚠️ Why You Need This

Your downloads are failing because YouTube is blocking unauthenticated requests:

```
❌ "Sign in to confirm you're not a bot"
❌ "Failed to extract any player response"  
❌ 0/10 tracks downloaded
```

**Solution:** Add your YouTube cookies → Downloads work ✅

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Get Your Cookies

**Option A - Browser Extension (Easiest):**

1. Install: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) (Chrome)
2. Go to https://youtube.com and login
3. Click the extension → Export → Save as `youtube_cookies.txt`

**Option B - Command Line:**
```bash
yt-dlp --cookies-from-browser chrome --cookies youtube_cookies.txt "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### Step 2: Deploy Cookies

**For Railway (Your Setup):**

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click your backend service
3. **Variables** tab → **New Variable**
4. Set:
   - Key: `YOUTUBE_COOKIES`
   - Value: *Paste entire contents of youtube_cookies.txt*
5. Save → Railway auto-redeploys ✅

**For Local Development:**

1. Copy `youtube_cookies.txt` to `server/` directory
2. Done! It auto-detects the file

### Step 3: Verify

Check your Railway logs for:
```
✅ Authenticated with YouTube cookies (file)
```

Instead of:
```
⚠️ No YouTube cookies found - downloads may be blocked
```

---

## ✅ What Changes Were Made

The backend now supports cookies in **3 ways** (priority order):

1. **`YOUTUBE_COOKIES` environment variable** ⭐ (Best for Railway/Render/Vercel)
2. **`youtube_cookies.txt` file in server/ folder** (Best for local dev)
3. **Browser extraction** (Local dev only - doesn't work in containers)

The system automatically picks the best available option.

---

## 🔐 Security

- ✅ Cookies stored securely as environment variables
- ✅ Already added to `.gitignore` (won't be committed)
- ✅ Not visible in public logs
- ⚠️ **Pro Tip:** Create a dedicated Google account just for downloads

---

## 🐛 Troubleshooting

### Still Getting "No cookies found"?

1. **Check Railway environment variable:**
   - Go to Railway → Your Service → Variables
   - Make sure `YOUTUBE_COOKIES` exists and has content
   - Value should be ~1-5 KB of text starting with `# Netscape HTTP Cookie File`

2. **Re-export cookies:**
   - Your cookies might have expired
   - Export fresh ones from YouTube
   - Update the `YOUTUBE_COOKIES` variable

3. **Verify you're logged in:**
   - Make sure you're logged into YouTube when exporting cookies
   - Try watching a video first to "activate" the session

### Downloads Still Failing?

- **Wait 2-3 minutes** after updating the environment variable (Railway needs to redeploy)
- Check Railway logs for the authentication message
- Try using a different browser for cookie export
- Cookies expire every 6-12 months - re-export if old

---

## 📖 Detailed Documentation

For more details, see:
- [`server/cookies-setup.md`](server/cookies-setup.md) - Full documentation
- [`server/youtube_cookies.txt.example`](server/youtube_cookies.txt.example) - Cookie file template

---

## 💡 Pro Tips

1. **Use a Dedicated Google Account:**
   - Create: `yourname.downloader@gmail.com`
   - Login to YouTube
   - Export cookies from that account
   - **Benefits:** Your personal account stays safe, easy to replace if banned

2. **Cookie Lifespan:**
   - Cookies last 6-12 months typically
   - When downloads start failing again, just re-export and update

3. **Team Setup:**
   - One person exports cookies
   - Share via environment variable (not the file itself)
   - Everyone uses the same authenticated session

---

## ❓ FAQ

**Q: Is this safe?**  
A: Yes, cookies are stored as environment variables (encrypted by Railway). Just don't use your main personal Google account.

**Q: Will I get banned?**  
A: Very unlikely with normal usage. If concerned, use a dedicated account.

**Q: Do I need to do this for every project?**  
A: Only once per deployment. Set the environment variable and forget about it.

**Q: What if cookies expire?**  
A: Downloads will start failing. Just re-export and update the environment variable.

---

**Need Help?** Open an issue or check the detailed guide in `server/cookies-setup.md` 🚀

