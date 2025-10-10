# 🍪 Add YouTube Cookies to Fix Downloads

## The Problem
YouTube is blocking downloads because it thinks you're a bot. Adding cookies fixes this!

---

## ✅ Quick Fix (5 minutes)

### Step 1: Export Your YouTube Cookies

**Option A: Using Browser Extension** (Easiest!)

1. **Install Extension:**
   - **Chrome**: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - **Firefox**: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
   - **Edge**: Use Chrome extension

2. **Go to YouTube**: Open https://youtube.com
   
3. **Login** to your Google account (if not already logged in)

4. **Click the Extension Icon** → Click "Export" or "Download"

5. **Save File As**: `youtube_cookies.txt`

---

### Step 2: Add Cookies to Your Server

**If Running Locally:**

1. Copy `youtube_cookies.txt` to your `server/` folder:
   ```
   track-miner/
   └── server/
       └── youtube_cookies.txt  ← Put it here
   ```

2. Restart your server:
   ```bash
   npm run dev
   ```

**If Deployed (Vercel/Render/Railway):**

1. Open `youtube_cookies.txt` in Notepad
2. **Copy ALL the text** (Ctrl+A, Ctrl+C)
3. Go to your hosting dashboard
4. Add Environment Variable:
   - **Variable Name:** `YOUTUBE_COOKIES`
   - **Value:** Paste all the cookie text
5. **Save** and **Redeploy**

---

## 🔒 Security Note

- ✅ These cookies only give access to **YOUR** YouTube account
- ✅ They expire after ~30 days (just re-export when they expire)
- ✅ No payment info or passwords are in cookies
- ⚠️ Don't share your cookies file publicly

---

## 🎯 That's It!

Once added, you'll see:
```
🍪 Using YouTube cookies for authentication
```

Instead of:
```
⚠️ No YouTube cookies found - may get blocked on shared IPs
```

Your downloads will work perfectly! 🎵

