# 🎯 Auto-Deploy Setup - Step by Step

## 📱 Step 1: GitHub Desktop Setup

### Open GitHub Desktop:
1. **Launch GitHub Desktop**
2. **File** → **Clone Repository**
3. **URL tab** → Enter: `https://github.com/Achraflgu/test.git`
4. **Local path** → Choose your project folder
5. **Clone** ✅

---

## 🖥️ Step 2: Render Auto-Deploy

### Go to Render:
1. **Open browser** → https://dashboard.render.com/
2. **Click**: `track-miner-backend` service
3. **Click**: **Settings** (left sidebar)

### Enable Auto-Deploy:
```
Build & Deploy Settings:
✅ Auto-Deploy: Yes
✅ Branch: main  
✅ Root Directory: server
✅ Build Command: npm install
✅ Start Command: node index.js
```

### Environment Variables:
```
✅ PORT=3001
✅ FRONTEND_URL=https://playful-frangipane-69de5a.netlify.app
```

---

## 🌐 Step 3: Netlify Auto-Deploy

### Go to Netlify:
1. **Open browser** → https://app.netlify.com/
2. **Click**: `playful-frangipane-69de5a` site
3. **Click**: **Site settings** → **Build & deploy**

### Enable Auto-Deploy:
```
Build Settings:
✅ Repository: Achraflgu/test
✅ Branch: main
✅ Build Command: npm run build
✅ Publish Directory: dist
```

### Environment Variables:
```
✅ VITE_API_URL=https://track-miner-backend.onrender.com
✅ VITE_WS_URL=wss://track-miner-backend.onrender.com
```

---

## 🧪 Step 4: Test It!

### Make a Change:
1. **Open any file** (e.g., `README.md`)
2. **Add a line**: `<!-- Auto-deploy test -->`
3. **Save file**

### Commit & Push:
1. **GitHub Desktop** → Shows your changes
2. **Summary**: "Test auto-deploy"
3. **Commit to main**
4. **Push origin** ✅

### Watch the Magic:
1. **Render** → **Logs** → See building...
2. **Netlify** → **Deploys** → See building...
3. **Wait 2-5 minutes**
4. **Your app updates!** 🎉

---

## 📊 How to Monitor

### Render Monitoring:
```
Dashboard → track-miner-backend → Logs
Look for:
✅ "Build successful"
✅ "Deploy successful" 
✅ "Service is live"
```

### Netlify Monitoring:
```
Dashboard → playful-frangipane-69de5a → Deploys
Look for:
✅ Green checkmark
✅ "Published"
✅ "Deploy successful"
```

---

## 🎯 Your New Workflow

### Before (Manual):
```
Code → Build → Upload → Deploy → Wait → Test
```

### After (Automatic):
```
Code → Push → Auto-Deploy → Live! 🚀
```

---

## 🔧 Troubleshooting

### Render Not Deploying:
- **Check**: Auto-deploy is "Yes"
- **Check**: Branch is "main"
- **Check**: Root directory is "server"
- **Manual**: Click "Manual Deploy"

### Netlify Not Deploying:
- **Check**: Repository connected
- **Check**: Branch is "main"  
- **Check**: Build command correct
- **Manual**: Click "Trigger deploy"

### Environment Variables:
- **Render**: Settings → Environment
- **Netlify**: Site settings → Environment variables

---

## 🎊 You're Done!

**Now every time you push to GitHub:**
1. ✅ Render rebuilds backend
2. ✅ Netlify rebuilds frontend  
3. ✅ Your app updates automatically
4. ✅ No manual work needed!

---

## 🚀 Quick Test Right Now:

1. **Add comment** to any file: `// auto-deploy test`
2. **Commit**: "Testing auto-deploy"
3. **Push**
4. **Wait 5 minutes**
5. **Check your live app** → Should have the change!

**Your YouTube fix will be live automatically!** 🎵

