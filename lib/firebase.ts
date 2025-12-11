import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// TODO: Replace with your actual Firebase Project Configuration
// You can get this from the Firebase Console -> Project Settings
const firebaseConfig = {
  apiKey: "AIzaSyAZwNev22PBisCkZLtptASaJ5sHTpanKXc",
  authDomain: "shadfocus-c07cb.firebaseapp.com",
  projectId: "shadfocus-c07cb",
  storageBucket: "shadfocus-c07cb.firebasestorage.app",
  messagingSenderId: "295641595526",
  appId: "1:295641595526:web:bf48e320013089a61cdb07",
  measurementId: "G-6EXZ9WH0RR"
};

// Initialize Firebase
let app: firebase.app.App;
let auth: firebase.auth.Auth;
let db: firebase.firestore.Firestore;
let googleProvider: firebase.auth.GoogleAuthProvider;

try {
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app();
  }
  
  auth = firebase.auth();
  
  // Set persistence to LOCAL to ensure auth state survives refreshes
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => console.error("Error setting auth persistence:", error));
    
  // Use device language for auth flows
  auth.useDeviceLanguage();

  db = firebase.firestore();
  googleProvider = new firebase.auth.GoogleAuthProvider();
} catch (error) {
  console.warn("Firebase not initialized. Add your config in lib/firebase.ts");
}

export { auth, db, googleProvider };
export default firebase;