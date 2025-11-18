#!/bin/bash

echo "🚀 ShopOS Video Scene Detector - GitHub & Vercel Deployment"
echo "============================================================"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit: ShopOS Video Scene Detector"
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

# Check if remote exists
if git remote | grep -q "origin"; then
    echo "✅ Remote 'origin' already configured"
else
    echo ""
    echo "📡 Adding GitHub remote..."
    git remote add origin https://github.com/ninadsuryaksha/shopos-video-scene-detector.git
    echo "✅ Remote added"
fi

echo ""
echo "📤 Pushing to GitHub..."
git branch -M main
git push -u origin main

echo ""
echo "✅ Code pushed to GitHub!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Deploy Backend to Railway:"
echo "   → Go to https://railway.app/"
echo "   → New Project → Deploy from GitHub"
echo "   → Select: ninadsuryaksha/shopos-video-scene-detector"
echo "   → Set root directory: /backend"
echo "   → Deploy and copy the URL"
echo ""
echo "2. Update Frontend with Backend URL:"
echo "   → Edit services/sceneDetectionService.ts"
echo "   → Edit components/GeminiAnalysis.tsx"
echo "   → Edit components/BatchGeminiAnalysis.tsx"
echo "   → Replace localhost:5001 with Railway URL"
echo "   → Commit and push changes"
echo ""
echo "3. Deploy Frontend to Vercel:"
echo "   → Go to https://vercel.com/"
echo "   → New Project"
echo "   → Import: ninadsuryaksha/shopos-video-scene-detector"
echo "   → Deploy"
echo ""
echo "🎉 Your site will be live at: shopos-video-scene-detector.vercel.app"

