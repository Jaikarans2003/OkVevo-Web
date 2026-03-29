'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { monitorHeartbeat } from '@/lib/boothSession';

interface SessionStatusProps {
  sessionId: string;
  showBanner?: boolean;
}

export default function SessionStatus({ sessionId, showBanner = true }: SessionStatusProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    setIsChecking(true);
    
    const unsubscribe = monitorHeartbeat(sessionId, (connected) => {
      setIsConnected(connected);
      setIsChecking(false);
    });

    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  const getStatusColor = () => {
    if (isChecking) return 'yellow';
    return isConnected ? 'green' : 'red';
  };

  const getStatusText = () => {
    if (isChecking) return 'Connecting...';
    return isConnected ? 'Camera Connected' : 'Camera Disconnected';
  };

  const statusColor = getStatusColor();

  return (
    <>
      {/* Compact Status Indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
        <div className={`w-2 h-2 rounded-full ${
          statusColor === 'green' ? 'bg-green-500 animate-pulse' :
          statusColor === 'red' ? 'bg-red-500' :
          'bg-yellow-500 animate-pulse'
        }`} />
        <span className={`text-xs font-bold ${
          statusColor === 'green' ? 'text-green-500' :
          statusColor === 'red' ? 'text-red-500' :
          'text-yellow-500'
        }`}>
          {getStatusText()}
        </span>
      </div>

      {/* Warning Banner */}
      {showBanner && !isConnected && !isChecking && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top duration-300">
          <div className="bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <div>
              <div className="font-black text-sm">Camera Disconnected</div>
              <div className="text-xs opacity-80">Check iPhone or wake it up</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
