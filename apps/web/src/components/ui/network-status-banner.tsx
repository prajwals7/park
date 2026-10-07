'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export interface NetworkStatusBannerProps {
  onStatusChange?: (isOnline: boolean) => void;
}

export function NetworkStatusBanner({ onStatusChange }: NetworkStatusBannerProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [showSimulatedOffline, setShowSimulatedOffline] = useState(false);

  useEffect(() => {
    // Check initial status
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      if (onStatusChange) onStatusChange(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (onStatusChange) onStatusChange(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onStatusChange]);

  const effectiveOnline = isOnline && !showSimulatedOffline;

  if (effectiveOnline) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-amber-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-md transition-all sticky top-14 md:top-0 z-40"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
        <div>
          <span className="font-bold">Offline / Poor Network:</span> Form drafts are saved locally
          on this device. Submissions use safe idempotency retry protection.
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowSimulatedOffline(false)}
        className="px-2 py-0.5 bg-amber-700/80 hover:bg-amber-800 rounded text-[11px] underline"
      >
        Dismiss
      </button>
    </div>
  );
}
