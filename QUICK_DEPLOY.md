# Quick Deploy to GitHub & Vercel

## Step 1: Push to GitHub

```bash
cd "/Users/ninad/Downloads/video-scene-detector (1)"

# Initialize git
git init
git add .
git commit -m "Initial commit"

# Create repository on GitHub first at:
# https://github.com/new
# Repository name: shopos-video-scene-detector
# Owner: ninadsuryaksha

# Then push
git remote add origin https://github.com/ninadsuryaksha/shopos-video-scene-detector.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy Backend to Railway

1. Go to https://railway.app/
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `ninadsuryaksha/shopos-video-scene-detector`
5. Set root directory to `/backend`
6. Click "Deploy"
7. Copy the deployed URL (e.g., `https://shopos-backend.railway.app`)

## Step 3: Update Frontend with Backend URL

Open these files and replace `http://localhost:5001` with your Railway backend URL:

1. `services/sceneDetectionService.ts`:
```typescript
const API_BASE_URL = "https://YOUR-RAILWAY-URL.railway.app/api";
```

2. `components/GeminiAnalysis.tsx` (3 fetch calls)
3. `components/BatchGeminiAnalysis.tsx` (3 fetch calls)

Then commit and push:
```bash
git add .
git commit -m "Update backend URL"
git push
```

## Step 4: Deploy Frontend to Vercel

1. Go to https://vercel.com/
2. Sign in with GitHub
3. Click "New Project"
4. Import `ninadsuryaksha/shopos-video-scene-detector`
5. Framework: Vite
6. Click "Deploy"

Your site will be live at: `shopos-video-scene-detector.vercel.app`

## Done! 🎉

Visit your live site and test it.

