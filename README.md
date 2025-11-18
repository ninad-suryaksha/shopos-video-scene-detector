# ShopOS Video Scene Detector

AI-powered video scene detection and analysis tool with automatic frame extraction and Gemini AI integration.

## Features

- 🎬 Automatic scene detection from uploaded videos
- 🖼️ Frame extraction from detected scenes
- 🤖 AI-powered analysis using Google Gemini 2.5 Flash
- 📊 Brand vibe extraction from videos
- 🎨 Image prompt generation for each scene
- 🎥 Comprehensive video prompt synthesis
- 📦 Batch processing for multiple videos
- 💾 Download analysis results and frames

## Tech Stack

**Frontend:**
- React 19
- TypeScript
- Vite
- TailwindCSS

**Backend:**
- Python 3.8+
- Flask
- OpenCV
- Google Generative AI API

## Deployment

### Frontend (Vercel)

This project is configured for automatic deployment to Vercel.

1. Push to GitHub
2. Import project in Vercel
3. Deploy

### Backend

The backend Flask server needs to be deployed separately on platforms like:
- Railway
- Render
- Heroku
- Google Cloud Run

**Environment Variables Required:**
- Backend API URL (update in frontend after backend deployment)

## Local Development

**Install Dependencies:**
```bash
npm install
cd backend && pip install -r requirements.txt
```

**Start Servers:**
```bash
# Terminal 1 - Backend
cd backend && python server.py

# Terminal 2 - Frontend  
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:5001

## API Integration

Requires Google Gemini API key for AI features. Users provide their API key in the UI.

## License

MIT License

