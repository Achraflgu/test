# 🚀 Quick Auto-Deploy Checklist

## ✅ Render (Backend) Setup

### Check These Settings:
- [ ] **Auto-Deploy**: Yes
- [ ] **Branch**: main  
- [ ] **Root Directory**: server
- [ ] **Environment Variables**:
  - [ ] `PORT=3001`
  - [ ] `FRONTEND_URL=https://playful-frangipane-69de5a.netlify.app`

### How to Check:
1. Go to: https://dashboard.render.com/
2. Click **track-miner-backend**
3. Click **Settings**
4. Scroll to **"Build & Deploy"**

---

## ✅ Netlify (Frontend) Setup

### Check These Settings:
- [ ] **Repository**: Achraflgu/test
- [ ] **Branch**: main
- [ ] **Build Command**: `npm run build`
- [ ] **Publish Directory**: `dist`
- [ ] **Environment Variables**:
  - [ ] `VITE_API_URL=https://track-miner-backend.onrender.com`
  - [ ] `VITE_WS_URL=wss://track-miner-backend.onrender.com`

### How to Check:
1. Go to: https://app.netlify.com/
2. Click **playful-frangipane-69de5a**
3. Click **Site settings** → **Build & deploy**

---

## 🧪 Test Auto-Deploy

### Quick Test:
1. **Open GitHub Desktop**
2. **Make tiny change** (add comment: `// test`)
3. **Commit**: "Auto-deploy test"
4. **Push to origin**
5. **Wait 2-5 minutes**
6. **Check your live app** → Should update!

---

## 📊 Monitor Deployments

### Render Logs:
- **URL**: https://dashboard.render.com/
- **Service** → **Logs** tab
- **Look for**: "Build successful" or "Deploy successful"

### Netlify Logs:
- **URL**: https://app.netlify.com/
- **Site** → **Deploys** tab  
- **Look for**: Green checkmark ✅

---

## 🎯 Your Workflow Now:

```
Code Change → GitHub Desktop → Push → Auto-Deploy → Live App! 🚀
```

**No more manual deployments!** ✨

