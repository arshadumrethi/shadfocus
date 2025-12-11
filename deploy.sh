#!/bin/bash

# Firebase Deployment Script
# Run this script to deploy your app to Firebase Hosting

set -e  # Exit on error

echo "🚀 Starting Firebase deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please login to Firebase..."
    firebase login
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the app
echo "🔨 Building the app..."
npm run build

# Deploy to Firebase
echo "🌐 Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Deployment complete!"
echo "🌍 Your app should be live at: https://shadfocus-c07cb.web.app"
echo ""
echo "⚠️  Don't forget to:"
echo "   1. Enable Google Authentication in Firebase Console"
echo "   2. Enable Firestore Database in Firebase Console"
echo "   3. Configure Firestore Security Rules"
echo ""
echo "See DEPLOY.md for detailed instructions."

