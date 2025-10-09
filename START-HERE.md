# 🚀 START HERE - Free Deployment Guide

## 🎯 What You're About to Do

Deploy your Track Miner app to the internet **for FREE** in ~20 minutes!

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   GitHub    │ ───> │  Render.com  │ ───> │   Netlify   │
│             │      │   (Backend)  │      │  (Frontend) │
│  Code Host  │      │   Python +   │      │     CDN     │
│             │      │    Node.js   │      │   Hosting   │
└─────────────┘      └──────────────┘      └─────────────┘
     FREE                 FREE                   FREE
```

---

## ✅ What's Already Done

I've prepared everything for you:

- ✅ **Backend configured** for production (CORS, env vars)
- ✅ **Frontend configured** for production (API URL)
- ✅ **Deployment configs** created (Render, Netlify)
- ✅ **Build scripts** ready (Python, FFmpeg, Node.js)
- ✅ **Documentation** written (step-by-step guides)

**You just need to**: Push to GitHub → Deploy to Render → Deploy to Netlify

---

## 📋 What You Need (All Free!)

1. ☑️ **GitHub Account** - https://github.com/join
2. ☑️ **Render Account** - https://dashboard.render.com/register  
3. ☑️ **Netlify Account** - https://app.netlify.com/signup

**Time Required**: 2 minutes to sign up for all

---

## 🎬 Quick Start (3 Steps)

### Step 1: Push to GitHub (5 min)

```bash
# In your project folder, run:
git init
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/track-miner.git
git push -u origin main
```

**Done!** ✅ Your code is on GitHub

---

### Step 2: Deploy Backend (10 min)

1. Go to: https://dashboard.render.com/
2. Click "**New +**" → "**Web Service**"
3. Connect your GitHub repo
4. Fill in:
   - **Name**: `track-miner-backend`
   - **Root Directory**: `server`
   - **Build Command**: 
     ```
     npm install && chmod +x render-build.sh && ./render-build.sh
     ```
   - **Start Command**: `node index.js`
   - **Instance Type**: ⚠️ **FREE** (very important!)
5. Add Environment Variables:
   - `PORT` = `3001`
   - `NODE_ENV` = `production`
6. Click "**Create Web Service**"
7. Wait ~10 minutes (grab a coffee ☕)
8. **Copy your URL**: `https://track-miner-backend.onrender.com`

**Done!** ✅ Your backend is live

---

### Step 3: Deploy Frontend (5 min)

1. Go to: https://app.netlify.com/
2. Click "**Add new site**" → "**Import project**"
3. Choose GitHub → Select your repo
4. Fill in:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click "**Show advanced**" → Add variable:
   - `VITE_API_URL` = `https://track-miner-backend.onrender.com`
     (Use YOUR backend URL from Step 2)
6. Click "**Deploy site**"
7. Wait ~3 minutes
8. **Your app is LIVE!** 🎉

**Done!** ✅ Your frontend is live

---

### Step 4: Connect Them (2 min)

1. Go back to Render dashboard
2. Click your backend service
3. Go to "**Environment**" tab
4. Update `FRONTEND_URL` to your Netlify URL
5. Click "**Save**"
6. Wait ~5 minutes for auto-redeploy

**Done!** ✅ Everything is connected

---

## 🎉 You're Live!

Visit your Netlify URL and enjoy!

Example: `https://wonderful-app-123abc.netlify.app`

---

## 📚 Need More Details?

| File | Purpose |
|------|---------|
| **DEPLOY-CHECKLIST.md** | ☑️ Step-by-step checklist |
| **DEPLOYMENT.md** | 📖 Full detailed guide |
| **DEPLOYMENT-SUMMARY.md** | 📄 Quick overview |

---

## ⚠️ Important Notes

### Free Tier Limitations:

**Render.com Backend** (FREE):
- ✅ 750 hours/month (more than enough)
- ⚠️ Sleeps after 15 minutes of inactivity
- ⚠️ First request takes 30-60 seconds to wake up
- ⚠️ No persistent file storage (downloads are temporary)

**Netlify Frontend** (FREE):
- ✅ Always online (never sleeps)
- ✅ 100GB bandwidth/month
- ✅ Fast global CDN

### What This Means:

✅ **Perfect for**:
- Sharing with friends
- Portfolio/demo
- Trying out the app
- Playing music
- Small downloads

⚠️ **Not ideal for**:
- Heavy batch downloading (50+ tracks)
- Permanent file storage

💡 **Pro Tip**: Use the deployed version for browsing/playing, use local installation for heavy downloading.

---

## 🆘 Troubleshooting

### "Service Unavailable" on first visit?
✅ **Normal!** Free tier is waking up. Wait 30-60 seconds and refresh.

### Can't connect frontend to backend?
- Check `VITE_API_URL` in Netlify matches your Render URL
- Check `FRONTEND_URL` in Render matches your Netlify URL
- Make sure both use `https://` (not `http://`)

### Build failing on Render?
- Check logs in Render dashboard
- Verify `render-build.sh` has execute permissions
- Make sure you selected **FREE** tier

---

## 💰 Cost Breakdown

| Service | Monthly Cost |
|---------|-------------|
| GitHub | $0.00 |
| Render | $0.00 |
| Netlify | $0.00 |
| **TOTAL** | **$0.00** |

**Forever.** 🎉

---

## 🚀 Auto-Deploy Bonus

Once set up, every time you push code to GitHub:
- ✅ Netlify auto-deploys frontend (2-3 min)
- ✅ Render auto-deploys backend (5-10 min)

**No manual work needed!**

---

## 📱 What's Next?

After deployment:
- Share your link with friends
- Add custom domain (optional, also free!)
- Keep developing locally
- Push updates → auto-deploy

---

## 🎯 Ready to Deploy?

Follow **DEPLOY-CHECKLIST.md** for step-by-step instructions!

Or read **DEPLOYMENT.md** for the full detailed guide.

---

**Let's go! 🚀**

Your app will be live in ~20 minutes!

