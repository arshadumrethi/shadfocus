import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { Clock, Layout, Zap } from 'lucide-react';

export const Login: React.FC = () => {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
            <Clock size={32} />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">ShadFocus</h1>
            <p className="text-gray-500">
              Your intelligent, cloud-synced focus companion.
            </p>
          </div>

          <div className="grid gap-4 py-6 text-left">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                <Layout size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Project Tracking</h3>
                <p className="text-sm text-gray-500">Organize work into custom color-coded projects.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">AI Insights</h3>
                <p className="text-sm text-gray-500">Get smart productivity coaching and analytics.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={signInWithGoogle} 
              className="w-full justify-center text-base py-3"
              themeColorClass="bg-gray-900"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </Button>
          </div>
          
          <p className="text-xs text-gray-400 mt-4">
            By signing in, you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};