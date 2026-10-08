'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollectorLogin } from '../../components/collector/collector-login';
import { Button } from '../../components/ui/button';
import { ShieldCheck, User, ShieldAlert, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [selectedGate, setSelectedGate] = useState('G2');

  const handleLoginSuccess = (user: {
    id: string;
    name: string;
    role: 'COLLECTOR' | 'ADMIN';
    gate: string;
  }) => {
    if (user.role === 'COLLECTOR') {
      router.push('/collector');
    } else {
      router.push('/admin');
    }
  };

  const handleQuickDemo = (role: 'COLLECTOR' | 'ADMIN') => {
    if (role === 'COLLECTOR') {
      router.push('/collector');
    } else {
      router.push('/admin');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Quick Demo Login Bar */}
        <div className="bg-neutral-800/90 border border-neutral-700/80 rounded-xl p-4 shadow-xl text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-400">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Quick Demo 1-Click Access
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs bg-neutral-900 border-primary-500/30 text-primary-300 hover:bg-primary-950/40"
              onClick={() => handleQuickDemo('COLLECTOR')}
            >
              <User className="w-3.5 h-3.5 mr-1 text-primary-400" />
              Collector Desk
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs bg-neutral-900 border-amber-500/30 text-amber-300 hover:bg-amber-950/40"
              onClick={() => handleQuickDemo('ADMIN')}
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-400" />
              Admin Portal
            </Button>
          </div>
        </div>

        {/* Standard Full Login Form */}
        <CollectorLogin
          selectedGate={selectedGate}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    </div>
  );
}
