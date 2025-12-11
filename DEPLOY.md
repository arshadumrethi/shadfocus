# Firebase Deployment Guide

## Prerequisites

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

## Deployment Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the app**:
   ```bash
   npm run build
   ```
   This will create a `dist` folder with the production build.

3. **Deploy to Firebase Hosting**:
   ```bash
   firebase deploy
   ```
   Or use the combined script:
   ```bash
   npm run deploy
   ```

## Firebase Console Configuration

After deployment, you need to configure Firebase Authentication and Firestore in the Firebase Console:

### 1. Enable Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **shadfocus-c07cb**
3. Navigate to **Authentication** → **Sign-in method**
4. Enable **Google** as a sign-in provider:
   - Click on "Google"
   - Toggle "Enable"
   - Add your support email
   - Save

### 2. Configure Authorized Domains

1. In **Authentication** → **Settings** → **Authorized domains**
2. Your Firebase hosting domain (`shadfocus-c07cb.web.app` and `shadfocus-c07cb.firebaseapp.com`) should be automatically added
3. If deploying to a custom domain, add it here

### 3. Enable Firestore Database

1. Go to **Firestore Database** in the Firebase Console
2. Click **Create database**
3. Choose **Start in test mode** (for initial testing) or **Start in production mode** (with security rules)
4. Select a location (choose the closest to your users)
5. Click **Enable**

### 4. Set Firestore Security Rules

Go to **Firestore Database** → **Rules** and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish** to save the rules.

## Testing After Deployment

1. Visit your deployed app: `https://shadfocus-c07cb.web.app`
2. Test Google Sign-In:
   - Click "Sign in with Google"
   - Complete the authentication flow
   - Verify you're logged in
3. Test Firestore:
   - Create a project or session
   - Check Firebase Console → Firestore Database to see the data
   - Verify data persists after refresh

## Troubleshooting

- **Authentication errors**: Make sure Google sign-in is enabled and authorized domains are configured
- **Firestore errors**: Ensure Firestore is enabled and security rules allow authenticated users
- **Build errors**: Check that all dependencies are installed (`npm install`)
- **Deployment errors**: Ensure you're logged in (`firebase login`) and have the correct project selected

