# 🚀 Deploy to GitHub & Vercel

## Prerequisites

- GitHub account (ninadsuryaksha)
- Vercel account (sign up with GitHub)
- Railway account (sign up with GitHub) - for backend

---

## Quick Deploy (Run These Commands)

### Step 1: Push to GitHub

```bash
cd "/Users/ninad/Downloads/video-scene-detector (1)"

# Initialize and push
./deploy.sh
```

Or manually:

```bash
cd "/Users/ninad/Downloads/video-scene-detector (1)"

git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ninadsuryaksha/shopos-video-scene-detector.git
git branch -M main
git push -u origin main
```

**Note:** Create the repository first at:
https://github.com/new
- Repository name: `shopos-video-scene-detector`
- Owner: `ninadsuryaksha`
- Public or Private: Your choice
- **DO NOT** initialize with README

---

### Step 2: Deploy Backend (Railway)

1. **Go to:** https://railway.app/
2. **Sign in** with your GitHub account (ninadsuryaksha)
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose: `ninadsuryaksha/shopos-video-scene-detector`
6. Railway will auto-detect Python
7. Click **"Deploy"**
8. **Wait** for deployment to complete
9. Click **"Settings"** → **"Networking"** → **"Generate Domain"**
10. **Copy the URL** (e.g., `https://shopos-backend-production.up.railway.app`)

---

### Step 3: Update Backend URL in Frontend

Replace `http://localhost:5001` with your Railway URL in these files:

**File 1:** `services/sceneDetectionService.ts`
```typescript
const API_BASE_URL = "https://YOUR-RAILWAY-URL/api";
```

**File 2:** `components/GeminiAnalysis.tsx` (3 locations)
```typescript
// Line ~57
const vibeResponse = await fetch('https://YOUR-RAILWAY-URL/api/gemini/vibe-extraction', {

// Line ~76
const imagePromptsResponse = await fetch('https://YOUR-RAILWAY-URL/api/gemini/image-prompts', {

// Line ~99
const videoPromptResponse = await fetch('https://YOUR-RAILWAY-URL/api/gemini/video-prompt', {
```

**File 3:** `components/BatchGeminiAnalysis.tsx` (3 locations)
```typescript
// Line ~93
const vibeResponse = await fetch('https://YOUR-RAILWAY-URL/api/gemini/vibe-extraction', {

// Line ~127
const imagePromptsResponse = await fetch('https://YOUR-RAILWAY-URL/api/gemini/image-prompts', {

// Line ~150
const videoPromptResponse = await fetch('https://YOUR-RAILWAY-URL/api/gemini/video-prompt', {
```

Then commit and push:
```bash
git add .
git commit -m "Update backend URL for production"
git push
```

---

### Step 4: Deploy Frontend (Vercel)

1. **Go to:** https://vercel.com/
2. **Sign in** with your GitHub account (ninadsuryaksha)
3. Click **"Add New..."** → **"Project"**
4. **Import** `ninadsuryaksha/shopos-video-scene-detector`
5. **Configure:**
   - Framework Preset: **Vite**
   - Root Directory: `./` (leave as default)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)
6. Click **"Deploy"**
7. **Wait** for deployment (2-3 minutes)

---

## 🎉 Your Site is Live!

**URL:** https://shopos-video-scene-detector.vercel.app

**To test:**
1. Visit the URL
2. Upload a video
3. Enter your Gemini API key
4. Run scene detection and AI analysis

---

## Troubleshooting

**If you get 404 errors:**
- Check that Railway backend is running
- Verify you updated all 6 fetch URLs correctly
- Check Railway logs for errors

**If CORS errors:**
- The backend already has CORS enabled
- Ensure Railway URL is correct

**If build fails on Vercel:**
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json

---

## Update Your Code Later

```bash
cd "/Users/ninad/Downloads/video-scene-detector (1)"

# Make your changes, then:
git add .
git commit -m "Your update message"
git push

# Vercel will auto-deploy the frontend
# Railway will auto-deploy the backend
```

---

## Need Help?

- **Railway Docs:** https://docs.railway.app/
- **Vercel Docs:** https://vercel.com/docs
- **GitHub Docs:** https://docs.github.com/

