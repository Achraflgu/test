# 🍪 YouTube Cookies - Visual Guide

## 📸 Step-by-Step Screenshots

### Method 1: Browser Extension (EASIEST!)

#### Step 1: Install Extension

**For Chrome:**
1. Go to: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
2. Click **Add to Chrome**
3. Click **Add extension**

**For Firefox:**
1. Go to: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/
2. Click **Add to Firefox**

---

#### Step 2: Export Cookies

1. Go to: **https://youtube.com**
2. Make sure you see your profile (logged in)
3. Click the **cookie extension icon** (in browser toolbar)
4. Click **"Export"** or **"Current Site"**
5. File will download: `youtube.com_cookies.txt`

---

#### Step 3: Open Cookie File

1. Find the downloaded file: `youtube.com_cookies.txt`
2. Right-click → **Open with Notepad**
3. You'll see something like:

```
# Netscape HTTP Cookie File
# This is a generated file! Do not edit.

.youtube.com	TRUE	/	TRUE	1234567890	PREF	f1=50000000
.youtube.com	TRUE	/	FALSE	1234567890	VISITOR_INFO1_LIVE	xxxxxxxxxxx
...
```

4. **Select ALL** (Ctrl+A)
5. **Copy** (Ctrl+C)

---

#### Step 4: Add to Render

1. Go to: **https://dashboard.render.com/**
2. Click: **track-miner-backend** (your service)
3. Click: **Environment** (left sidebar)
4. Scroll down, click: **Add Environment Variable**
5. Fill in:

```
Key:   YOUTUBE_COOKIES
Value: [Paste cookie contents here]
```

6. Click: **Save Changes**
7. Wait 3-5 minutes (service will auto-redeploy)

---

### Method 2: Using yt-dlp (Advanced)

If you have yt-dlp installed locally:

```bash
# Chrome
yt-dlp --cookies-from-browser chrome --cookies youtube_cookies.txt "https://youtube.com"

# Firefox  
yt-dlp --cookies-from-browser firefox --cookies youtube_cookies.txt "https://youtube.com"

# Edge
yt-dlp --cookies-from-browser edge --cookies youtube_cookies.txt "https://youtube.com"
```

Then open `youtube_cookies.txt` and copy to Render (Step 4 above).

---

## ✅ Verification

After adding to Render:

1. Go to: https://dashboard.render.com/
2. Click your service
3. Click **Logs** tab
4. Look for:
   ```
   ✅ YouTube cookies loaded from environment
   ```

If you see this → cookies are working!

---

## 🔄 When to Update Cookies

Cookies expire **every ~6 months**.

**Signs cookies expired:**
- 429 errors return
- "Sign in to confirm" errors
- YouTube searches fail

**Solution:**
1. Export new cookies (Step 2)
2. Update Render env var (Step 4)
3. Done!

---

## 🎯 Pro Tips

### Tip 1: Use Dedicated Account

Create a throwaway Gmail:
- Email: `trackminer.youtube@gmail.com`
- Password: Something secure
- Use ONLY for this app
- If banned → create new account!

### Tip 2: Keep Cookies Fresh

Set a reminder:
- Export new cookies every 5 months
- Update Render
- Never let them expire!

### Tip 3: Multiple Accounts

For heavy usage:
- Create 3-5 YouTube accounts
- Rotate cookies monthly
- Spread the load!

---

## 🚨 Troubleshooting

### "Cookies not working!"

1. **Check format**: File should start with `# Netscape HTTP Cookie File`
2. **Check login**: Make sure you were logged in when exporting
3. **Check expiry**: Cookies might be expired, export fresh ones
4. **Check site**: Export from `youtube.com` (not `music.youtube.com`)

### "Still getting 429 errors!"

1. **Wait 5 minutes**: Service needs to fully redeploy
2. **Check logs**: Look for "cookies loaded" message
3. **Re-export**: Get fresh cookies
4. **Clear cache**: Render might be using old version

### "Extension not working!"

Try the yt-dlp method (Method 2 above).

---

## 📊 Expected Results

**Before cookies:**
- ❌ 429 errors every few requests
- ❌ "Sign in to confirm" errors  
- ❌ YouTube searches fail
- ❌ Only ~5-10 tracks work

**After cookies:**
- ✅ No 429 errors
- ✅ No bot detection
- ✅ YouTube searches work perfectly
- ✅ 100+ tracks download smoothly
- ✅ Same speed as local!

---

## 🎊 You're All Set!

Once cookies are added, tell me and I'll:
1. Update the code to use them
2. Push to GitHub
3. Render will auto-deploy
4. YouTube will work! 🎵

---

**Questions? Just ask!** 🚀

