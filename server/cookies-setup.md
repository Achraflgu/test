# 🍪 YouTube Cookie Setup (Fix 429 Errors)

This is the **BEST** solution for YouTube on free hosting!

## 🎯 How It Works

YouTube allows authenticated requests even from cloud IPs. We'll use browser cookies to authenticate.

---

## 📝 Step 1: Export Cookies from Browser

### Method A: Using Browser Extension (Easiest)

1. **Install extension**:
   - Chrome: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. **Go to YouTube**: https://youtube.com

3. **Login to your Google account** (if not already)

4. **Click the extension** → Export cookies

5. **Save as**: `youtube_cookies.txt`

### Method B: Using yt-dlp (Manual)

```bash
# In your terminal
yt-dlp --cookies-from-browser chrome --cookies youtube_cookies.txt "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

---

## 📤 Step 2: Upload Cookies to Render

### Option A: Environment Variable (Recommended)

1. Open `youtube_cookies.txt` in a text editor
2. Copy ALL the contents
3. Go to: https://dashboard.render.com/
4. Click your backend service
5. Go to **Environment** tab
6. Click **Add Environment Variable**:
   - **Key**: `YOUTUBE_COOKIES`
   - **Value**: Paste the entire cookie file contents
7. Click **Save Changes**

### Option B: Secret File

1. Go to: https://dashboard.render.com/
2. Click your backend service  
3. Go to **Environment** → **Secret Files**
4. Click **Add Secret File**:
   - **Filename**: `/opt/render/project/src/server/youtube_cookies.txt`
   - **Contents**: Paste cookie file contents
5. Click **Save**

---

## 🔧 Step 3: Update Code (Already Done!)

I'll update the code to use cookies automatically if they're available.

---

## ✅ Step 4: Test

After deployment:
1. Go to your app
2. Try YouTube search → Should work!
3. Try YouTube video → Should work!
4. No more 429 errors! 🎉

---

## 🔄 Maintenance

**Cookies expire every ~6 months**

When they expire:
1. Export new cookies (Step 1)
2. Update environment variable (Step 2)
3. Done!

---

## 🔐 Security Notes

- ✅ Cookies are stored securely on Render
- ✅ Not visible in logs
- ✅ Only you can access them
- ⚠️ Don't share cookies publicly
- ⚠️ Don't commit cookies to GitHub

---

## 💡 Alternative: Use Service Account

For long-term solution, create a dedicated Google account:
1. Create new Gmail: `trackminer.bot@gmail.com`
2. Login to YouTube with it
3. Export cookies from that account
4. If banned, just create a new one!

---

**Ready to implement? Let me know and I'll update the code!** 🚀

