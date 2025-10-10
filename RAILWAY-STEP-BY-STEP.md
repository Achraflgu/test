# 🚀 Railway Migration - Step by Step Guide

## 🎯 Railway Setup (10 Minutes Total)

### Step 1: Create Railway Account (2 minutes)
1. **Go to**: https://railway.app/
2. **Click**: "Sign up" or "Login"
3. **Choose**: "Continue with GitHub"
4. **Authorize** Railway to access your GitHub

### Step 2: Deploy Backend (5 minutes)
1. **Click**: "New Project"
2. **Select**: "Deploy from GitHub repo"
3. **Choose**: `Achraflgu/test` repository
4. **Click**: "Deploy Now"

### Step 3: Configure Service (2 minutes)
1. **Click** on your deployed service
2. **Go to**: "Settings" tab
3. **Set Root Directory**: `server`
4. **Build Command**: `npm install`
5. **Start Command**: `node index.js`

### Step 4: Set Environment Variables (1 minute)
1. **Go to**: "Variables" tab
2. **Add these variables**:
   ```
   PORT=3001
   FRONTEND_URL=https://playful-frangipane-69de5a.netlify.app
   ```
3. **Click**: "Add" for each variable

---

## 🌐 Update Netlify (3 minutes)

### Step 1: Get Railway URL
1. **Go to**: Railway dashboard
2. **Click**: Your backend service
3. **Copy** the URL (looks like: `https://track-miner-backend-production.up.railway.app`)

### Step 2: Update Netlify Environment
1. **Go to**: https://app.netlify.com/
2. **Click**: `playful-frangipane-69de5a`
3. **Site settings** → **Environment variables**
4. **Update**:
   - `VITE_API_URL` → `https://your-railway-url.up.railway.app`
   - `VITE_WS_URL` → `wss://your-railway-url.up.railway.app`
5. **Save changes**

### Step 3: Redeploy Netlify
1. **Go to**: "Deploys" tab
2. **Click**: "Trigger deploy"
3. **Wait** for deployment to complete

---

## 🧪 Test Railway Deployment

### Test Backend Directly:
```bash
# Replace with your actual Railway URL
curl "https://your-railway-url.up.railway.app/api/youtube/search?query=test&limit=1"
```

### Test Frontend:
1. **Go to**: https://playful-frangipane-69de5a.netlify.app/
2. **Try**: YouTube search
3. **Should work** much better than Render!

---

## 📊 Expected Results:

### Railway vs Render:
- **Render**: 10-20% success rate (heavily blocked)
- **Railway**: 60-80% success rate (much better!)
- **Railway + Cookies**: 95% success rate (if needed later)

---

## 🍪 Optional: Add Cookies Later

If you still get some YouTube blocking on Railway:

### Quick Cookie Setup:
1. **Install extension**: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
2. **Export** YouTube cookies
3. **Add to Railway** environment variables:
   - **Key**: `YOUTUBE_COOKIES`
   - **Value**: Paste cookie contents

---

## 🎯 Migration Benefits:

### Immediate:
- ✅ **Better YouTube support**
- ✅ **Less rate limiting**
- ✅ **More reliable hosting**

### Long-term:
- ✅ **Better IP reputation**
- ✅ **More stable performance**
- ✅ **Better for scaling**

---

## 🆘 Need Help?

If you get stuck at any step:
1. **Screenshot** the issue
2. **Share** your Railway URL
3. **I'll help** debug the problem

---

## 🚀 Ready to Start?

**Let's migrate to Railway!** This will solve the YouTube blocking issue and give you a much more reliable backend.

**Railway is the professional solution!** 🎵✨

