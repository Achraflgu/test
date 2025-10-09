# 📝 Deployment Checklist

Quick checklist to deploy Track Miner for FREE!

## ☑️ Pre-Deployment

- [ ] Create GitHub account
- [ ] Create Render.com account  
- [ ] Create Netlify account
- [ ] Have your code ready in this folder

## ☑️ GitHub Setup

- [ ] Create new repository on GitHub (name: `track-miner`)
- [ ] Make it **Public** (required for free tier)
- [ ] Run these commands:
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  git remote add origin https://github.com/YOUR_USERNAME/track-miner.git
  git push -u origin main
  ```

## ☑️ Backend (Render.com)

- [ ] Go to https://dashboard.render.com/
- [ ] Click "New +" → "Web Service"
- [ ] Connect GitHub repo `track-miner`
- [ ] Configure:
  - Name: `track-miner-backend`
  - Root Directory: `server`
  - Build Command: `npm install && chmod +x render-build.sh && ./render-build.sh`
  - Start Command: `node index.js`
  - **Instance Type: FREE** ⚠️
- [ ] Add Environment Variables:
  - `PORT` = `3001`
  - `FRONTEND_URL` = `https://temp.netlify.app` (update later)
  - `NODE_ENV` = `production`
- [ ] Click "Create Web Service"
- [ ] Wait ~10 minutes for deployment
- [ ] **Copy your backend URL**: `https://track-miner-backend.onrender.com`

## ☑️ Frontend (Netlify)

- [ ] Go to https://app.netlify.com/
- [ ] Click "Add new site" → "Import an existing project"
- [ ] Choose GitHub → Select `track-miner` repo
- [ ] Configure:
  - Build command: `npm run build`
  - Publish directory: `dist`
- [ ] Click "Show advanced" → Add environment variable:
  - `VITE_API_URL` = `https://track-miner-backend.onrender.com` (your backend URL)
- [ ] Click "Deploy site"
- [ ] Wait ~3 minutes
- [ ] **Copy your frontend URL**: `https://wonderful-app-123.netlify.app`
- [ ] (Optional) Change site name in settings

## ☑️ Final Configuration

- [ ] Go back to Render.com dashboard
- [ ] Click your backend service
- [ ] Go to "Environment" tab
- [ ] Update `FRONTEND_URL` to your Netlify URL
- [ ] Click "Save Changes"
- [ ] Wait ~5 minutes for redeploy

## ☑️ Testing

- [ ] Visit your Netlify URL
- [ ] Open browser console (F12)
- [ ] Should see: `🌐 API Configuration: {...}`
- [ ] Try loading a playlist
- [ ] Try playing music
- [ ] Try searching
- [ ] Try downloading a small playlist (2-3 tracks)

## 🎉 Done!

Your app is live at: **https://your-app.netlify.app**

---

## 📌 URLs to Save

**Frontend**: ______________________________________

**Backend**: ______________________________________

**GitHub**: ______________________________________

---

## ⚠️ Remember

- First request takes 30-60 seconds (free tier wakes up)
- Downloads are temporary (no persistent storage on free tier)
- Service sleeps after 15 minutes of inactivity
- For heavy downloading, use local installation

---

**Need detailed instructions? See DEPLOYMENT.md**

