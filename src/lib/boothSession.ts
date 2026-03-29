import { realtimeDb, storage } from '@/config/firebase';
import { ref as dbRef, set, onValue, update, serverTimestamp, off, get } from 'firebase/database';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';

export interface PhotoRequest {
  id: string;
  slotId: 'fullBody' | 'face';
  status: 'pending' | 'capturing' | 'uploaded' | 'failed';
  createdAt: number;
  attemptCount: number;
}

export interface PhotoResponse {
  imageUrl: string;
  previewUrl: string;
  status: 'success' | 'failed';
  uploadedAt: number;
  attemptNumber: number;
}

export interface BoothSession {
  status: 'active' | 'idle';
  lastActivity: number;
  cameraHeartbeat: number;
  currentRequest?: PhotoRequest;
  responses?: Record<string, PhotoResponse>;
}

const HEARTBEAT_INTERVAL = 4000; // 4 seconds
const HEARTBEAT_TIMEOUT = 10000; // 10 seconds

let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Validate and sanitize session ID
 */
function validateSessionId(sessionId: string): string {
  const cleaned = sessionId.trim().toUpperCase();
  // Remove any invalid characters
  const sanitized = cleaned.replace(/[^A-Z0-9_-]/g, '');
  
  if (!sanitized) {
    throw new Error('Invalid session ID: must contain letters or numbers');
  }
  
  if (sanitized.includes('/') || sanitized.includes(':') || sanitized.includes('.')) {
    throw new Error('Invalid session ID: contains forbidden characters');
  }
  
  return sanitized;
}

/**
 * Create or join a booth session
 */
export async function joinSession(sessionId: string): Promise<void> {
  const validSessionId = validateSessionId(sessionId);
  const sessionRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}`);
  
  const snapshot = await get(sessionRef);
  if (!snapshot.exists()) {
    await set(sessionRef, {
      status: 'active',
      lastActivity: Date.now(),
      cameraHeartbeat: Date.now(),
      responses: {}
    });
  }
}

/**
 * Reset session (clear all photos and requests)
 */
export async function resetSession(sessionId: string): Promise<void> {
  const validSessionId = validateSessionId(sessionId);
  const sessionRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}`);
  await update(sessionRef, {
    currentRequest: null,
    responses: {},
    lastActivity: Date.now(),
    status: 'active'
  });
}

/**
 * Start heartbeat (iPhone sends ping every 3-5 seconds)
 */
export function startHeartbeat(sessionId: string): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  const validSessionId = validateSessionId(sessionId);
  const heartbeatRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}/cameraHeartbeat`);
  
  // Send initial heartbeat
  set(heartbeatRef, Date.now());

  // Send heartbeat every 4 seconds
  heartbeatInterval = setInterval(() => {
    set(heartbeatRef, Date.now()).catch(err => {
      console.error('Heartbeat failed:', err);
    });
  }, HEARTBEAT_INTERVAL);
}

/**
 * Stop heartbeat
 */
export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Monitor heartbeat and check if camera is connected
 */
export function monitorHeartbeat(
  sessionId: string,
  onConnectionChange: (connected: boolean) => void
): () => void {
  const validSessionId = validateSessionId(sessionId);
  const heartbeatRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}/cameraHeartbeat`);
  
  let checkInterval: NodeJS.Timeout;

  const unsubscribe = onValue(heartbeatRef, (snapshot) => {
    const lastHeartbeat = snapshot.val();
    
    if (checkInterval) clearInterval(checkInterval);
    
    // Check connection status immediately
    const isConnected = lastHeartbeat && (Date.now() - lastHeartbeat < HEARTBEAT_TIMEOUT);
    onConnectionChange(isConnected);

    // Continue checking every 2 seconds
    checkInterval = setInterval(() => {
      if (lastHeartbeat) {
        const connected = Date.now() - lastHeartbeat < HEARTBEAT_TIMEOUT;
        onConnectionChange(connected);
      } else {
        onConnectionChange(false);
      }
    }, 2000);
  });

  return () => {
    off(heartbeatRef);
    if (checkInterval) clearInterval(checkInterval);
    unsubscribe();
  };
}

/**
 * Check if camera is currently connected (one-time check)
 */
export async function isCameraConnected(sessionId: string): Promise<boolean> {
  const validSessionId = validateSessionId(sessionId);
  const heartbeatRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}/cameraHeartbeat`);
  const snapshot = await get(heartbeatRef);
  const lastHeartbeat = snapshot.val();
  
  if (!lastHeartbeat) return false;
  return Date.now() - lastHeartbeat < HEARTBEAT_TIMEOUT;
}

/**
 * Create a photo request (iPad)
 */
export async function createPhotoRequest(
  sessionId: string,
  slotId: 'fullBody' | 'face',
  attemptCount: number = 1
): Promise<string> {
  const validSessionId = validateSessionId(sessionId);
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const request: PhotoRequest = {
    id: requestId,
    slotId,
    status: 'pending',
    createdAt: Date.now(),
    attemptCount
  };

  const requestRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}/currentRequest`);
  await set(requestRef, request);

  return requestId;
}

/**
 * Listen to current request (iPhone)
 */
export function listenToCurrentRequest(
  sessionId: string,
  onRequest: (request: PhotoRequest | null) => void
): () => void {
  const validSessionId = validateSessionId(sessionId);
  const requestRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}/currentRequest`);
  
  const unsubscribe = onValue(requestRef, (snapshot) => {
    const request = snapshot.val() as PhotoRequest | null;
    onRequest(request);
  });

  return () => {
    off(requestRef);
    unsubscribe();
  };
}

/**
 * Update request status
 */
export async function updateRequestStatus(
  sessionId: string,
  status: PhotoRequest['status']
): Promise<void> {
  const validSessionId = validateSessionId(sessionId);
  const statusRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}/currentRequest/status`);
  await set(statusRef, status);
}

/**
 * Compress image to target size
 */
async function compressImage(dataUrl: string, maxWidth: number, quality: number = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      reject(new Error('Invalid image data URL'));
      return;
    }

    if (!dataUrl.startsWith('data:image/')) {
      reject(new Error('Data URL must be an image'));
      return;
    }

    const img = new Image();
    
    img.onload = () => {
      try {
        if (img.width === 0 || img.height === 0) {
          reject(new Error('Image has invalid dimensions'));
          return;
        }

        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas 2D context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        if (!compressedDataUrl || compressedDataUrl === 'data:,') {
          reject(new Error('Failed to generate compressed image'));
          return;
        }
        
        resolve(compressedDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      reject(new Error(`Failed to load image: ${error}`));
    };
    
    img.src = dataUrl;
  });
}

/**
 * Submit photo response (iPhone)
 */
export async function submitPhotoResponse(
  sessionId: string,
  requestId: string,
  imageDataUrl: string,
  slotId: 'fullBody' | 'face'
): Promise<void> {
  const validSessionId = validateSessionId(sessionId);
  
  console.log('Starting photo submission:', { validSessionId, requestId, slotId });
  
  try {
    // Update status to uploading
    console.log('Updating status to capturing...');
    await updateRequestStatus(validSessionId, 'capturing');

    // Compress images
    console.log('Compressing images...');
    const maxWidth = slotId === 'fullBody' ? 1920 : 1080;
    
    let fullImage: string;
    let preview: string;
    
    try {
      fullImage = await compressImage(imageDataUrl, maxWidth, 0.85);
      console.log('Full image compressed successfully');
    } catch (compressError: any) {
      console.error('Failed to compress full image:', compressError);
      throw new Error(`Image compression failed: ${compressError.message || 'Unknown compression error'}`);
    }
    
    try {
      preview = await compressImage(imageDataUrl, 800, 0.7);
      console.log('Preview image compressed successfully');
    } catch (compressError: any) {
      console.error('Failed to compress preview image:', compressError);
      throw new Error(`Preview compression failed: ${compressError.message || 'Unknown compression error'}`);
    }
    
    console.log('Images compressed successfully');

    // Upload to Firebase Storage
    console.log('Uploading to Firebase Storage...');
    const timestamp = Date.now();
    const fullImageRef = storageRef(storage, `booth_photos/${validSessionId}/${requestId}_full.jpg`);
    const previewRef = storageRef(storage, `booth_photos/${validSessionId}/${requestId}_preview.jpg`);

    await uploadString(fullImageRef, fullImage, 'data_url');
    console.log('Full image uploaded');
    
    await uploadString(previewRef, preview, 'data_url');
    console.log('Preview image uploaded');

    const fullImageUrl = await getDownloadURL(fullImageRef);
    const previewUrl = await getDownloadURL(previewRef);
    console.log('Download URLs obtained:', { fullImageUrl, previewUrl });

    // Write response to database
    const response: PhotoResponse = {
      imageUrl: fullImageUrl,
      previewUrl,
      status: 'success',
      uploadedAt: timestamp,
      attemptNumber: 1
    };

    console.log('Writing response to Realtime Database...');
    const responseRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}/responses/${requestId}`);
    await set(responseRef, response);
    console.log('Response written successfully');

    // Update request status
    console.log('Updating final status to uploaded...');
    await updateRequestStatus(validSessionId, 'uploaded');
    console.log('Photo submission complete!');
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Unknown error',
      code: error?.code || 'NO_CODE',
      name: error?.name || 'Unknown',
      type: error?.constructor?.name,
      isPermissionError: error?.code === 'PERMISSION_DENIED' || error?.message?.includes('permission'),
      isStorageError: error?.code?.startsWith('storage/'),
      isDatabaseError: error?.code?.startsWith('database/'),
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    };
    
    console.error('❌ Error submitting photo response:', errorDetails);
    
    if (errorDetails.isPermissionError) {
      console.error('🔒 PERMISSION DENIED: Check Firebase Realtime Database and Storage rules!');
    }
    
    try {
      await updateRequestStatus(validSessionId, 'failed');
    } catch (updateError) {
      console.error('Failed to update status to failed:', updateError);
    }
    
    throw new Error(`Photo submission failed: ${errorDetails.message} (${errorDetails.code})`);
  }
}

/**
 * Listen to response for a specific request (iPad)
 */
export function listenToResponse(
  sessionId: string,
  requestId: string,
  onResponse: (response: PhotoResponse | null) => void
): () => void {
  const validSessionId = validateSessionId(sessionId);
  const responseRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}/responses/${requestId}`);
  
  const unsubscribe = onValue(responseRef, (snapshot) => {
    const response = snapshot.val() as PhotoResponse | null;
    onResponse(response);
  });

  return () => {
    off(responseRef);
    unsubscribe();
  };
}

/**
 * Get session data
 */
export async function getSession(sessionId: string): Promise<BoothSession | null> {
  const validSessionId = validateSessionId(sessionId);
  const sessionRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}`);
  const snapshot = await get(sessionRef);
  return snapshot.exists() ? snapshot.val() as BoothSession : null;
}

/**
 * Listen to entire session
 */
export function listenToSession(
  sessionId: string,
  onSession: (session: BoothSession | null) => void
): () => void {
  const validSessionId = validateSessionId(sessionId);
  const sessionRef = dbRef(realtimeDb, `booth_sessions/${validSessionId}`);
  
  const unsubscribe = onValue(sessionRef, (snapshot) => {
    const session = snapshot.val() as BoothSession | null;
    onSession(session);
  });

  return () => {
    off(sessionRef);
    unsubscribe();
  };
}
