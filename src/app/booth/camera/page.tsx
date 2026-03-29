'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, Wifi, WifiOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { 
  startHeartbeat, 
  stopHeartbeat, 
  listenToCurrentRequest, 
  submitPhotoResponse,
  updateRequestStatus,
  joinSession,
  PhotoRequest
} from '@/lib/boothSession';

export default function BoothCameraPage() {
  const [sessionId, setSessionId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<PhotoRequest | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastPingTime, setLastPingTime] = useState<number>(Date.now());
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isVideoReady, setIsVideoReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load session ID from localStorage
  useEffect(() => {
    const savedSessionId = localStorage.getItem('boothSessionId');
    if (savedSessionId) {
      setSessionId(savedSessionId);
    }
  }, []);

  // Initialize camera - only when connected to session
  useEffect(() => {
    if (!isConnected) return;

    async function initCamera() {
      try {
        console.log('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        
        console.log('Camera access granted, stream:', stream);
        console.log('Video tracks:', stream.getVideoTracks());
        
        setCameraStream(stream);
        
        // Small delay to ensure video element is mounted
        setTimeout(() => {
          if (videoRef.current) {
            console.log('Setting stream to video element');
            videoRef.current.srcObject = stream;
            
            // Wait for video to be ready
            videoRef.current.onloadedmetadata = () => {
              console.log('Video metadata loaded');
              // Ensure video plays
              videoRef.current?.play().catch(err => {
                console.error('Error playing video:', err);
              });
            };
            
            videoRef.current.onplaying = () => {
              console.log('Video is playing, dimensions:', {
                width: videoRef.current?.videoWidth,
                height: videoRef.current?.videoHeight
              });
              setIsVideoReady(true);
            };
            
            videoRef.current.onerror = (error) => {
              console.error('Video element error:', error);
            };
          } else {
            console.error('Video ref is still null after delay');
          }
        }, 100);
      } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Could not access camera. Please grant camera permissions.');
      }
    }

    initCamera();

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isConnected]);

  // Connect to session
  useEffect(() => {
    if (!sessionId) return;

    let unsubscribeRequest: (() => void) | null = null;

    async function connect() {
      try {
        await joinSession(sessionId);
        setIsConnected(true);
        
        // Start heartbeat
        startHeartbeat(sessionId);
        
        // Update ping time indicator
        const pingInterval = setInterval(() => {
          setLastPingTime(Date.now());
        }, 4000);

        // Listen for photo requests
        unsubscribeRequest = listenToCurrentRequest(sessionId, (request) => {
          setCurrentRequest(request);
          
          if (request && request.status === 'pending') {
            setCaptureStatus('idle');
          }
        });

        return () => {
          clearInterval(pingInterval);
        };
      } catch (error) {
        console.error('Error connecting to session:', error);
        setIsConnected(false);
      }
    }

    const cleanup = connect();

    return () => {
      stopHeartbeat();
      if (unsubscribeRequest) unsubscribeRequest();
      cleanup.then(fn => fn && fn());
    };
  }, [sessionId]);

  const handleSessionIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSessionId = sessionId.trim().toUpperCase();
    if (cleanSessionId && !cleanSessionId.includes('/') && !cleanSessionId.includes(':')) {
      localStorage.setItem('boothSessionId', cleanSessionId);
      window.location.reload();
    } else {
      alert('Invalid session ID. Please enter only letters and numbers (e.g., BOOTH1)');
    }
  };

  const capturePhoto = async () => {
    if (!currentRequest || !videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);
    setCaptureStatus('idle');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Validate video dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('Video has invalid dimensions. Camera may not be ready.');
      }
      
      console.log('Capturing photo from video:', {
        width: video.videoWidth,
        height: video.videoHeight
      });
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0);
      
      // Convert to data URL with high quality
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      // Validate the data URL
      if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
        throw new Error('Failed to capture valid image data');
      }
      
      console.log('Image captured successfully, size:', Math.round(imageDataUrl.length / 1024), 'KB');

      await submitPhotoResponse(sessionId, currentRequest.id, imageDataUrl, currentRequest.slotId);
      
      setCaptureStatus('success');
      setTimeout(() => setCaptureStatus('idle'), 2000);
    } catch (error: any) {
      console.error('Error capturing photo:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack,
        fullError: error
      });
      setCaptureStatus('error');
      await updateRequestStatus(sessionId, 'failed');
    } finally {
      setIsCapturing(false);
    }
  };

  if (!sessionId || !isConnected) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Camera className="w-16 h-16 mx-auto mb-4 text-[#FF6B35]" />
            <h1 className="text-3xl font-black mb-2">Booth Camera</h1>
            <p className="text-white/50">Enter session ID to connect</p>
          </div>

          <form onSubmit={handleSessionIdSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-white/70 mb-2 uppercase tracking-wider">
                Session ID
              </label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                placeholder="BOOTH1"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors uppercase"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-[#FF6B35] hover:bg-[#FF8F6B] text-white font-black uppercase tracking-widest rounded-xl transition-colors"
            >
              Connect
            </button>
          </form>
        </div>
      </div>
    );
  }

  const timeSinceLastPing = Date.now() - lastPingTime;
  const pingStatus = timeSinceLastPing < 5000 ? 'active' : 'stale';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FF6B35]/20 flex items-center justify-center">
            <Camera className="w-5 h-5 text-[#FF6B35]" />
          </div>
          <div>
            <div className="font-black text-sm">Booth Camera</div>
            <div className="text-xs text-white/50">Session: {sessionId}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Heartbeat indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            {pingStatus === 'active' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-green-500">Connected</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs font-bold text-yellow-500">Syncing...</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Request Status Overlay */}
        {currentRequest && currentRequest.status === 'pending' && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-[#FF6B35] text-white px-6 py-3 rounded-full font-black text-sm uppercase tracking-wider shadow-lg animate-pulse">
              {currentRequest.slotId === 'fullBody' ? 'Capture Full Body Photo' : 'Capture Face Close-up'}
              <span className="ml-2 text-xs opacity-75">
                (Attempt {currentRequest.attemptCount}/3)
              </span>
            </div>
          </div>
        )}

        {/* Capture Status */}
        {captureStatus !== 'idle' && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
            <div className={`px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 ${
              captureStatus === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {captureStatus === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Photo Uploaded!
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Upload Failed
                </>
              )}
            </div>
          </div>
        )}

        {/* No Request State */}
        {!currentRequest && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="text-center">
              <Wifi className="w-16 h-16 mx-auto mb-4 text-white/30" />
              <p className="text-xl font-bold text-white/50">Waiting for capture request...</p>
              <p className="text-sm text-white/30 mt-2">iPad will trigger photo capture</p>
            </div>
          </div>
        )}
      </div>

      {/* Capture Button */}
      {currentRequest && currentRequest.status === 'pending' && (
        <div className="p-6 border-t border-white/10">
          <button
            onClick={capturePhoto}
            disabled={isCapturing || !isVideoReady}
            className="w-full py-6 bg-[#FF6B35] hover:bg-[#FF8F6B] disabled:bg-white/10 disabled:text-white/30 text-white font-black uppercase tracking-widest rounded-2xl transition-all text-lg flex items-center justify-center gap-3"
          >
            {isCapturing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Capturing...
              </>
            ) : !isVideoReady ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Camera Initializing...
              </>
            ) : (
              <>
                <Camera className="w-6 h-6" />
                Capture Photo
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
