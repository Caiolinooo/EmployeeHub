/**
 * Helper functions for API URL handling
 * This ensures that API calls work correctly in both development and production environments
 */

/**
 * Get the base API URL based on the environment
 * Uses NEXT_PUBLIC_API_URL if available, otherwise falls back to relative URL
 */
export function getApiBaseUrl(): string {
  // Use the environment variable if available
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    // In browser, avoid cross-origin during dev (e.g., env points to localhost but page runs on 192.168.x.x)
    if (typeof window !== 'undefined') {
      try {
        const envOrigin = new URL(envUrl).origin;
        const winOrigin = window.location.origin;
        if (envOrigin !== winOrigin) {
          // Prefer current origin to prevent CORS in local dev
          return `${winOrigin}/api`;
        }
      } catch {
        // If envUrl is not absolute, fall back to current origin
        return `${window.location.origin}/api`;
      }
    }
    return envUrl;
  }
  
  // In browser context, try to get from window
  if (typeof window !== 'undefined') {
    // For production, use the current origin
    return `${window.location.origin}/api`;
  }
  
  // Default fallback to relative path
  return '/api';
}

/**
 * Build a complete API URL from a path
 * @param path - The API endpoint path (e.g., '/auth/login')
 * @returns The complete API URL
 */
export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  
  // Ensure path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // If baseUrl already ends with /api, don't duplicate it
  if (baseUrl.endsWith('/api')) {
    return `${baseUrl}${normalizedPath}`;
  }
  
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Get the app base URL
 * Uses NEXT_PUBLIC_APP_URL if available, otherwise falls back to window.location.origin
 */
export function getAppBaseUrl(): string {
  // Use the environment variable if available
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // In browser context, use the current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Default fallback (should not happen in practice)
  return '';
}
