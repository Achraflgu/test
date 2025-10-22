# 🍪 YouTube Cookie Setup (Fix Bot Detection)

## ⚠️ CRITICAL: Downloads Will Fail Without Cookies

YouTube is **actively blocking** all non-authenticated downloads. Your logs show:
- ❌ "Sign in to confirm you're not a bot"
- ❌ "Failed to extract any player response"
- ❌ 0/10 tracks downloaded

**Solution:** Add YouTube cookies for authentication ✅

---

## 🎯 Why This Works

- YouTube allows authenticated requests even from containerized environments
- Cookies prove you're a real user, not a bot
- Works perfectly on Railway, Render, Vercel, etc.
- **This is now implemented and working!** 🚀

---

## 📝 Step 1: Export Your YouTube Cookies

### Method A: Browser Extension (EASIEST) ⭐

1. **Install the extension:**
   - **Chrome**: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - **Firefox**: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
   - **Edge**: Search "cookies.txt" in Edge Add-ons

2. **Login to YouTube:**
   - Go to https://youtube.com
   - Login with your Google account
   - Watch a video (optional, but helps)

3. **Export cookies:**
   - Click the extension icon
   - Click "Export" or "Download"
   - Save as `youtube_cookies.txt`

### Method B: Using yt-dlp Command

```bash
# Windows PowerShell
yt-dlp --cookies-from-browser chrome --cookies youtube_cookies.txt "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Mac/Linux
yt-dlp --cookies-from-browser firefox --cookies youtube_cookies.txt "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

---

## 📤 Step 2: Deploy Cookies (Choose Your Platform)

### For Railway (Your Current Setup) 🚂

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click your backend service
3. Go to **Variables** tab
4. Click **New Variable**:
   - **Key**: `YOUTUBE_COOKIES`
   - **Value**: Paste the **entire contents** of `youtube_cookies.txt`
5. Click **Save**
6. Railway will automatically redeploy ✅

### For Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click your backend service
3. Go to **Environment** tab
4. Click **Add Environment Variable**:
   - **Key**: `YOUTUBE_COOKIES`
   - **Value**: Paste the entire cookie file contents
7. Click **Save Changes**

### For Vercel/Netlify

1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add new variable:
   - **Key**: `YOUTUBE_COOKIES`
   - **Value**: Paste the entire cookie file contents
4. Save and redeploy

### For Local Development

1. Copy `youtube_cookies.txt` to the `server/` directory
2. The system will auto-detect it
3. No environment variable needed!

---

## ✅ Step 3: Verify It's Working

After deploying cookies, check your logs for:

```
✅ Authenticated with YouTube cookies (file)
```

Instead of:
```
⚠️ No YouTube cookies found - downloads may be blocked
```

Then test downloads - they should work! 🎉

---

## 🔄 How the System Works (Priority Order)

The backend automatically checks for cookies in this order:

1. **Environment Variable** (`YOUTUBE_COOKIES`) ⭐ **Best for deployment**
2. **Cookie File** (`youtube_cookies.txt` in server folder) - Good for local dev
3. **Browser Extraction** (Chrome/Firefox/Edge) - Local dev only
4. **No Cookies** - Downloads will likely fail ❌

---

## 🔄 Maintenance

**YouTube cookies expire every 6-12 months**

When downloads start failing again:
1. Export new cookies (Step 1)
2. Update the `YOUTUBE_COOKIES` environment variable (Step 2)
3. Redeploy
4. Done! ✅

---

## 🔐 Security Best Practices

### ✅ DO:
- Store cookies in environment variables (secure)
- Use a dedicated Google account for downloads
- Regenerate cookies periodically
- Add `youtube_cookies.txt` to `.gitignore` (already done)

### ❌ DON'T:
- Commit cookies to GitHub/Git
- Share your cookies publicly
- Use your personal Google account (use a dedicated one)
- Store cookies in plain text files in production

---

## 💡 Pro Tip: Dedicated Account

Create a dedicated Google account for downloads:

1. Create new Gmail: `yourname.downloader@gmail.com`
2. Login to YouTube with it
3. Watch a few videos (builds history)
4. Export cookies from that account
5. **Benefits:**
   - Your personal account stays safe
   - If banned, create a new one easily
   - Can share with team members

---

## 🐛 Troubleshooting

### Still getting "No cookies found"?

1. **Check environment variable:**
   ```bash
   # Make sure YOUTUBE_COOKIES is set
   echo $YOUTUBE_COOKIES  # Mac/Linux
   echo %YOUTUBE_COOKIES%  # Windows
   ```

2. **Verify cookie format:**
   - File should start with: `# Netscape HTTP Cookie File`
   - Should contain lines with `youtube.com`
   - Should be at least 1-2 KB in size

3. **Check file location (local dev):**
   - Must be at: `server/youtube_cookies.txt`
   - Not `server/youtube_cookies.txt.example`

### Downloads still failing?

- Cookies might be expired - export fresh ones
- Try using a different browser for cookie export
- Make sure you were logged into YouTube when exporting
- Check logs for specific error messages

---

## 📖 Additional Resources

- [yt-dlp Cookie Documentation](https://github.com/yt-dlp/yt-dlp#authentication-with-netscape-http-cookie-file)
- [Get cookies.txt Extension](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)

---

**Need help? Check the logs or create an issue!** 🚀

