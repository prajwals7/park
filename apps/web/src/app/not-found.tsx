'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { TreePine, Home, LogIn } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
        <TreePine className="w-8 h-8 text-emerald-400" />
      </div>
      <h1 className="text-4xl font-extrabold text-white mb-2">404</h1>
      <h2 className="text-xl font-bold text-slate-200 mb-2">Page Not Found</h2>
      <p className="text-sm text-slate-400 max-w-sm mb-6">
        The requested screen does not exist. Please return to the login screen or main desk.
      </p>
      <div className="flex gap-3">
        <Link href="/login">
          <Button variant="primary" size="md" className="gap-2">
            <LogIn className="w-4 h-4" />
            Go to Login
          </Button>
        </Link>
        <Link href="/">
          <Button variant="outline" size="md" className="gap-2 bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700">
            <Home className="w-4 h-4" />
            Home Page
          </Button>
        </Link>
      </div>
    </div>
  );
}
