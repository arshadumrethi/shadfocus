import React, { createContext, useContext, useEffect, useState } from 'react';
import firebase from 'firebase/compat/app';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextType {
  user: firebase.User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    
    // Check if we are returning from a redirect sign-in
    auth.getRedirectResult().catch((err) => {
      console.error("Redirect sign-in error", err);
      setError(err.message);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    if (!auth || !googleProvider) {
      setError("Firebase is not configured. Please check lib/firebase.ts");
      return;
    }
    try {
      await auth.signInWithPopup(googleProvider);
    } catch (err: any) {
      console.error("Error signing in", err);
      let errorMessage = err.message;
      
      // Handle specific environment errors common in cloud IDEs
      if (err.code === 'auth/operation-not-supported-in-this-environment' || err.code === 'auth/unauthorized-domain') {
        errorMessage = "Domain not authorized by Firebase.";
      }
      
      setError(errorMessage);
    }
  };

  const signInWithGoogleRedirect = async () => {
    setError(null);
    if (!auth || !googleProvider) {
      setError("Firebase is not configured. Please check lib/firebase.ts");
      return;
    }
    try {
      await auth.signInWithRedirect(googleProvider);
    } catch (err: any) {
      console.error("Error signing in with redirect", err);
      setError(err.message);
    }
  };

  const logout = async () => {
    if (auth) {
      try {
        await auth.signOut();
      } catch (err: any) {
        console.error("Error signing out", err);
        setError(err.message);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, signInWithGoogleRedirect, logout }}>
      {children}
    </AuthContext.Provider>
  );
};