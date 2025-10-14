# 🚀 FREE Deployment Guide

Deploy your Track Miner app to the internet **100% FREE** using:
- ✅ **Frontend**: Netlify (Free)
- ✅ **Backend**: Render.com (Free tier)
- ✅ **Code hosting**: GitHub (Free)

---

## 📋 Prerequisites

1. **GitHub Account** (free) - [Sign up](https://github.com/join)
2. **Netlify Account** (free) - [Sign up](https://app.netlify.com/signup)
3. **Render.com Account** (free) - [Sign up](https://dashboard.render.com/register)

---

## 🎯 Step 1: Push Code to GitHub

### 1.1 Create a GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click the "+" icon → "New repository"
3. Name it: `track-miner`
4. Make it **Public** (required for free tiers)
5. Click "Create repository"

### 1.2 Push Your Code

Open terminal in your project folder and run:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Track Miner app"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/track-miner.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🖥️ Step 2: Deploy Backend to Render.com

### 2.1 Create New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "**New +**" → "**Web Service**"
3. Connect your GitHub account if not already connected
4. Select your `track-miner` repository
5. Click "**Connect**"

### 2.2 Configure the Service

Fill in these settings:

| Setting | Value |
|---------|-------|
| **Name** | `track-miner-backend` (or any name you like) |
| **Region** | Oregon (US West) *(free tier)* |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && chmod +x render-build.sh && ./render-build.sh` |
| **Start Command** | `node index.js` |
| **Instance Type** | `Free` ⚠️ **Important!** |

### 2.3 Add Environment Variables

Click "**Advanced**" → "**Add Environment Variable**":

| Key | Value |
|-----|-------|
| `PORT` | `3001` |
| `FRONTEND_URL` | `https://your-app.netlify.app` *(we'll update this later)* |
| `NODE_ENV` | `production` |

### 2.4 Deploy

1. Click "**Create Web Service**"
2. Wait 5-10 minutes for deployment (free tier is slow)
3. Once deployed, copy your backend URL (e.g., `https://track-miner-backend.onrender.com`)

⚠️ **Important**: Free tier spins down after 15 minutes of inactivity. First request after inactivity takes ~1 minute to wake up.

---

## 🌐 Step 3: Deploy Frontend to Netlify

### 3.1 Create .env File

In your project root, create a file named `.env`:

```env
VITE_API_URL=https://track-miner-backend.onrender.com
```

**Replace** `https://track-miner-backend.onrender.com` with your actual Render.com URL from Step 2.4.

### 3.2 Update and Push Changes

```bash
# Add .env file (it's gitignored, so we don't commit it)
# Instead, we'll set it in Netlify dashboard

git add .
git commit -m "Add deployment configuration"
git push origin main
```

### 3.3 Deploy to Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click "**Add new site**" → "**Import an existing project**"
3. Choose "**Deploy with GitHub**"
4. Select your `track-miner` repository
5. Configure build settings:

| Setting | Value |
|---------|-------|
| **Branch to deploy** | `main` |
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |

6. Click "**Show advanced**" → "**New variable**":

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://track-miner-backend.onrender.com` *(your backend URL)* |

7. Click "**Deploy site**"

### 3.4 Get Your Frontend URL

1. Wait 2-3 minutes for deployment
2. Copy your Netlify URL (e.g., `https://wonderful-app-123abc.netlify.app`)

### 3.5 (Optional) Custom Domain

1. In Netlify, go to "**Site settings**" → "**Domain management**"
2. Click "**Options**" → "**Edit site name**"
3. Change to something memorable: `track-miner-app.netlify.app`

---

## 🔄 Step 4: Update Backend CORS

Now that you have your frontend URL, update the backend:

### 4.1 Update Render.com Environment Variable

1. Go back to [Render Dashboard](https://dashboard.render.com/)
2. Click on your `track-miner-backend` service
3. Go to "**Environment**" tab
4. Edit `FRONTEND_URL` to your Netlify URL: `https://track-miner-app.netlify.app`
5. Click "**Save Changes**"
6. Render will automatically redeploy (takes ~5 minutes)

---

## ✅ Step 5: Test Your Deployment

1. Visit your Netlify URL: `https://track-miner-app.netlify.app`
2. Open browser console (F12) - you should see:
   ```
   🌐 API Configuration: { API_URL: 'https://track-miner-backend.onrender.com', ... }
   ```
3. Try loading a playlist
4. Try playing music
5. Try downloading (⚠️ see limitations below)

---

## ⚠️ Important Limitations of Free Tier

### Render.com Backend (Free):
- ❗ **Spins down after 15 minutes** of inactivity
- ❗ First request after sleep takes **30-60 seconds** to wake up
- ❗ **Limited CPU/RAM** - downloads may be slower
- ❗ **No persistent storage** - downloaded files are temporary
  - Files are deleted when service restarts
  - Use this for **preview/playback** only
  - Users should download to their local machine

### Netlify Frontend (Free):
- ✅ Always online (no sleep)
- ✅ Fast CDN
- ✅ 100GB bandwidth/month (plenty for most users)

### Recommended User Flow:
1. Search/load playlist → ✅ Works perfectly
2. Play music inline → ✅ Works perfectly  
3. View track details → ✅ Works perfectly
4. Download files → ⚠️ **Limited on free tier**
   - Files stored temporarily on Render
   - Must download to browser before server restarts
   - For serious downloading, run locally

---

## 🔧 Troubleshooting

### Backend won't start:
- Check Render logs: Dashboard → Service → "Logs" tab
- Verify Python/FFmpeg installed: Look for build errors
- Check environment variables are set

### Frontend can't connect to backend:
- Check browser console for CORS errors
- Verify `VITE_API_URL` in Netlify environment variables
- Verify `FRONTEND_URL` in Render environment variables
- Make sure both URLs match exactly (including https://)

### "Service Unavailable" on first request:
- ✅ **This is normal!** Free tier sleeps after inactivity
- Wait 30-60 seconds, refresh the page
- Subsequent requests will be fast

### Downloads fail:
- Free tier has limited disk space
- Try smaller playlists (< 20 tracks)
- Use local installation for large downloads

---

## 🚀 Optional: Auto-Deploy on Push

Both Netlify and Render automatically deploy when you push to GitHub!

```bash
# Make changes to your code
git add .
git commit -m "Add new feature"
git push origin main

# Netlify and Render will auto-deploy! ✨
```

---

## 💡 Tips for Free Tier

1. **Keep backend warm**: Visit the app at least once every 15 minutes during active use
2. **Small batches**: Download 5-10 tracks at a time
3. **Be patient**: First load takes 30-60 seconds (server waking up)
4. **Local for heavy use**: Use local installation for batch downloading 50+ tracks

---

## 📊 Free Tier Limits Summary

| Service | Limit | Impact |
|---------|-------|--------|
| **Render** | 750 hours/month | ✅ Plenty (31 days × 24h = 744h) |
| **Render** | Spins down after 15min | ⚠️ Slow first request |
| **Render** | Limited storage | ⚠️ Temp files only |
| **Netlify** | 100GB bandwidth | ✅ ~10,000 page loads |
| **Netlify** | 300 build minutes | ✅ ~300 deploys |

---

## 🎉 You're Live!

Your app is now deployed and accessible worldwide! 🌍

- **Frontend**: `https://track-miner-app.netlify.app`
- **Backend**: `https://track-miner-backend.onrender.com`

Share the frontend URL with anyone! 🚀

---

## 📝 Next Steps

- ⭐ Star the repo on GitHub
- 🔗 Share with friends
- 💬 Add more features
- 📱 Make it mobile-responsive
- 🎨 Customize the design

---

## 🆘 Need Help?

- Render Docs: https://render.com/docs
- Netlify Docs: https://docs.netlify.com
- GitHub Issues: Open an issue in your repo

---

**Happy Deploying! 🎵✨**

