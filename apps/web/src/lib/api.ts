/**
 * AegisPulse Production API & WebSocket URL Helper
 *
 * Resolves API and WebSocket URLs seamlessly across:
 * 1. Local development (proxied by Vite dev server via relative paths)
 * 2. Production Vercel -> Render cross-origin deployment via VITE_API_URL and VITE_WS_URL
 */

export const API_BASE: string = (import.meta as any).env?.VITE_API_URL || '';

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE.replace(/\/$/, '')}${cleanPath}` : cleanPath;
}

export function wsUrl(path: string = '/api/v1/stream/ws'): string {
  const explicitWs = (import.meta as any).env?.VITE_WS_URL;
  if (explicitWs) return explicitWs;

  if (API_BASE) {
    const wsProto = API_BASE.startsWith('https:') ? 'wss:' : 'ws:';
    const cleanHost = API_BASE.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${wsProto}//${cleanHost}${cleanPath}`;
  }

  if (typeof window !== 'undefined' && window.location) {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${wsProto}//${window.location.host}${cleanPath}`;
  }

  return `ws://localhost:3001${path}`;
}
