# 🔐 How to Push with Achraflgu Account

You have changes committed locally but need to push to `Achraflgu/test` repository.

## ⚡ Quick Fix: Use Personal Access Token

### Step 1: Create Token

1. Go to: https://github.com/settings/tokens
2. Click "**Generate new token (classic)**"
3. Name: "Track Miner Deploy"
4. Expiration: 90 days (or No expiration)
5. Select scope: ✅ **repo** (full control of private repositories)
6. Scroll down, click "**Generate token**"
7. **COPY THE TOKEN** (you only see it once!)
   - It looks like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 2: Push with Token

In PowerShell, run:

```powershell
git push https://YOUR_TOKEN_HERE@github.com/Achraflgu/test.git main
```

**Replace `YOUR_TOKEN_HERE` with your actual token!**

Example:
```powershell
git push https://ghp_abc123xyz456@github.com/Achraflgu/test.git main
```

---

## 🔄 Or: Update Git Credentials

### Option A: Use GitHub CLI

1. Download: https://cli.github.com/
2. Install and run:
   ```powershell
   gh auth login
   ```
3. Choose: **GitHub.com** → **HTTPS** → Login with browser
4. Sign in as `Achraflgu`
5. Then push normally:
   ```powershell
   git push origin main
   ```

### Option B: Use GitHub Desktop

1. Download: https://desktop.github.com/
2. Sign in with `Achraflgu` account
3. Add this repository
4. Sync/Push from the app

---

## ✅ After Pushing

Once pushed, Render will automatically redeploy with the YouTube fix!

Wait 3-5 minutes, then test at:
**https://playful-frangipane-69de5a.netlify.app/**

YouTube search should work without 429 errors! 🎉

---

## 🆘 Still Having Issues?

If you can't push, you can also:

1. **Manually update on GitHub**:
   - Go to: https://github.com/Achraflgu/test/blob/main/server/index.js
   - Click "Edit" (pencil icon)
   - Replace lines 1923-1930 with the updated code
   - Commit directly on GitHub

2. **Or use the existing deployment**:
   - Spotify playlists work perfectly!
   - YouTube has rate limits but still functional
   - The fix improves reliability but isn't critical

---

**Need the changes?** See `server/index.js` lines 1923-1932 and 2063-2072.

