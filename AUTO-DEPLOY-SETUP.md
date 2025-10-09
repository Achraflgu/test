# 🔄 Auto-Deploy Setup Guide

## 🎯 Goal: Push to GitHub → App Updates Automatically!

When you push code to GitHub, both your backend (Render) and frontend (Netlify) will automatically redeploy!

---

## 📋 Step 1: Connect GitHub Desktop to Your Repo

### If you haven't cloned yet:

1. **Open GitHub Desktop**
2. **File** → **Clone Repository**
3. **URL tab** → Enter: `https://github.com/Achraflgu/test.git`
4. **Choose folder** → Select your project folder
5. **Clone**

### If already cloned:
- GitHub Desktop should already be connected! ✅

---

## 🚀 Step 2: Configure Render Auto-Deploy

### Go to Render Dashboard:
1. Visit: https://dashboard.render.com/
2. Click your **track-miner-backend** service
3. Click **Settings** (left sidebar)

### Enable Auto-Deploy:
1. Scroll to **"Build & Deploy"** section
2. **Auto-Deploy**: Should be **"Yes"** ✅
3. **Branch**: Should be **"main"** ✅
4. **Root Directory**: Should be **"server"** ✅

### If not enabled:
1. Click **"Enable Auto-Deploy"**
2. Select **"main"** branch
3. Click **"Save"**

---

## 🌐 Step 3: Configure Netlify Auto-Deploy

### Go to Netlify Dashboard:
1. Visit: https://app.netlify.com/
2. Click your **playful-frangipane-69de5a** site
3. Click **Site settings** → **Build & deploy**

### Enable Auto-Deploy:
1. **Build settings** → **Continuous Deployment**
2. **Connected Git repository**: Should show **"Achraflgu/test"** ✅
3. **Branch to deploy**: Should be **"main"** ✅
4. **Build command**: Should be **"npm run build"** ✅
5. **Publish directory**: Should be **"dist"** ✅

### If not connected:
1. Click **"Link repository"**
2. Select **"GitHub"**
3. Choose **"Achraflgu/test"**
4. Select **"main"** branch
5. Configure:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Click **"Deploy site"**

---

## 🔧 Step 4: Environment Variables (Important!)

### Render Backend:
Make sure these are set:
```
PORT=3001
FRONTEND_URL=https://playful-frangipane-69de5a.netlify.app
```

### Netlify Frontend:
Make sure these are set:
```
VITE_API_URL=https://track-miner-backend.onrender.com
VITE_WS_URL=wss://track-miner-backend.onrender.com
```

---

## ✅ Step 5: Test Auto-Deploy

### Make a Small Change:
1. **Open GitHub Desktop**
2. **Make a tiny change** (add a comment to any file)
3. **Commit** with message: "Test auto-deploy"
4. **Push to origin** (main branch)

### Watch the Magic:
1. **Render** will automatically start building (check logs)
2. **Netlify** will automatically start building (check logs)
3. **Both will deploy** in 2-5 minutes
4. **Your app updates!** 🎉

---

## 📊 How to Monitor Deployments

### Render (Backend):
1. Go to: https://dashboard.render.com/
2. Click your service
3. **"Logs"** tab → See build progress
4. **"Events"** tab → See deployment history

### Netlify (Frontend):
1. Go to: https://app.netlify.com/
2. Click your site
3. **"Deploys"** tab → See build progress
4. **"Functions"** tab → See any errors

---

## 🚨 Troubleshooting

### Render Not Deploying:
- **Check**: Branch is "main" ✅
- **Check**: Root directory is "server" ✅
- **Check**: Auto-deploy is "Yes" ✅
- **Manual**: Click "Manual Deploy" → "Deploy latest commit"

### Netlify Not Deploying:
- **Check**: Repository is connected ✅
- **Check**: Branch is "main" ✅
- **Check**: Build command is correct ✅
- **Manual**: Click "Trigger deploy" → "Deploy site"

### Environment Variables Missing:
- **Render**: Settings → Environment → Add missing vars
- **Netlify**: Site settings → Environment variables → Add missing vars

---

## 🎯 Workflow Now:

### Daily Development:
1. **Make changes** in your code
2. **Commit** in GitHub Desktop
3. **Push** to GitHub
4. **Wait 2-5 minutes**
5. **App updates automatically!** ✨

### No More Manual Deploys:
- ❌ No more clicking "Deploy" buttons
- ❌ No more manual uploads
- ❌ No more waiting for builds
- ✅ **Just push and go!**

---

## 🔄 Advanced: Branch Protection

### Optional - Protect Main Branch:
1. **GitHub** → **Settings** → **Branches**
2. **Add rule** for "main" branch
3. **Require pull request reviews** (optional)
4. **Require status checks** (optional)

This prevents accidental pushes to main.

---

## 🎊 You're All Set!

**Now when you:**
1. Make changes
2. Commit in GitHub Desktop  
3. Push to GitHub

**Your app automatically updates!** 🚀

---

## 📱 Quick Test:

Try this right now:
1. Add a comment to any file
2. Commit: "Auto-deploy test"
3. Push
4. Watch both services rebuild!

**Your YouTube fix will be live in minutes!** 🎵

