# Deployment Guide

## GitHub Setup

1. **Initialize Git Repository:**
```bash
cd "/Users/ninad/Downloads/video-scene-detector (1)"
git init
git add .
git commit -m "Initial commit: ShopOS Video Scene Detector"
```

2. **Create GitHub Repository:**
- Go to https://github.com/ninadsuryaksha
- Create new repository: `shopos-video-scene-detector`
- Don't initialize with README (we already have one)

3. **Push to GitHub:**
```bash
git remote add origin https://github.com/ninadsuryaksha/shopos-video-scene-detector.git
git branch -M main
git push -u origin main
```

## Backend Deployment (Railway)

**Railway is recommended for Python/Flask backends**

1. **Install Railway CLI:**
```bash
npm install -g @railway/cli
```

2. **Deploy Backend:**
```bash
cd backend
railway login
railway init
railway up
```

3. **Set Environment Variables in Railway Dashboard:**
- Python version: 3.12
- Start command: `python server.py`

4. **Get Backend URL:**
- Copy the deployed URL (e.g., `https://shopos-backend.railway.app`)

## Frontend Deployment (Vercel)

1. **Update Backend URL:**

Edit `services/sceneDetectionService.ts`:
```typescript
const API_BASE_URL = "https://your-railway-backend-url.railway.app/api";
```

Edit `components/GeminiAnalysis.tsx` and `components/BatchGeminiAnalysis.tsx`:
```typescript
// Replace http://localhost:5001 with your Railway backend URL
const response = await fetch('https://your-railway-backend-url.railway.app/api/gemini/vibe-extraction'
```

2. **Commit Changes:**
```bash
git add .
git commit -m "Update backend URL for production"
git push
```

3. **Deploy to Vercel:**

**Option A - Vercel Dashboard:**
- Go to https://vercel.com
- Click "New Project"
- Import `ninadsuryaksha/shopos-video-scene-detector`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Click "Deploy"

**Option B - Vercel CLI:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

4. **Set Custom Domain (Optional):**
- In Vercel dashboard → Settings → Domains
- The default will be: `shopos-video-scene-detector.vercel.app`
- Or add custom domain

## Alternative: Deploy Backend to Vercel (Serverless)

If you want to deploy backend to Vercel as serverless functions:

1. Create `api/index.py` in project root:
```python
from backend.server import app
```

2. Create `vercel.json`:
```json
{
  "builds": [
    {
      "src": "api/index.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "api/index.py"
    }
  ]
}
```

Note: This approach may have limitations with video processing due to serverless constraints.

## Environment Variables

**Backend (Railway):**
- `PORT` - Auto-set by Railway
- `FLASK_ENV` - Set to `production`

**Frontend (Vercel):**
- `VITE_API_URL` - Your backend URL (if using environment variable)

## Post-Deployment

1. **Test the deployment:**
- Visit https://shopos-video-scene-detector.vercel.app
- Upload a test video
- Verify scene detection works
- Test Gemini AI features with API key

2. **Monitor:**
- Railway: Check logs in Railway dashboard
- Vercel: Check deployment logs in Vercel dashboard

## Troubleshooting

**CORS Issues:**
- Ensure Flask-CORS is configured in backend
- Update allowed origins in `server.py` if needed

**API Connection Issues:**
- Verify backend URL is correct in frontend
- Check Railway backend is running
- Check Railway logs for errors

**Build Failures:**
- Verify Node.js version (16+) in Vercel
- Check Python version (3.8+) in Railway
- Review build logs for missing dependencies

## Cost

- **Vercel:** Free tier includes hobby projects
- **Railway:** Free tier includes $5/month credit
- **Google Gemini API:** Pay-per-use (users provide own API key)

