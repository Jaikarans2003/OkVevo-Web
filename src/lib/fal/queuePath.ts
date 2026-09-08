export type FalQueueKind = 'submit' | 'status' | 'response' | 'cancel';

export type FalQueuePath =
  | { kind: 'submit'; endpoint: string; requestId?: undefined }
  | { kind: 'status' | 'response' | 'cancel'; endpoint: string; requestId: string };

export function parseFalQueuePath(path: string[]): FalQueuePath {
  const parts = path.filter(Boolean);
  const requestsAt = parts.indexOf('requests');
  if (requestsAt <= 0) {
    const endpoint = parts.join('/');
    if (!endpoint) throw new Error('missing Fal endpoint');
    return { kind: 'submit', endpoint };
  }
  const endpoint = parts.slice(0, requestsAt).join('/');
  const requestId = parts[requestsAt + 1];
  const tail = parts[requestsAt + 2];
  if (!endpoint || !requestId) throw new Error('missing Fal request id');
  if (tail === 'status') return { kind: 'status', endpoint, requestId };
  if (tail === 'cancel') return { kind: 'cancel', endpoint, requestId };
  if (!tail) return { kind: 'response', endpoint, requestId };
  throw new Error(`unknown Fal queue path: ${parts.join('/')}`);
}
