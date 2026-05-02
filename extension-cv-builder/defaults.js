/**
 * Hosted deployment defaults for the unpacked extension.
 * - Set CVB_API_ORIGIN to match client/.env VITE_API_URL (scheme + host, no /api).
 * - webAppOrigin: SPA root (Vercel etc.), no trailing slash.
 */
const CVB_API_ORIGIN = 'https://resume-generator-production-b138.up.railway.app';

globalThis.CVB_DEFAULTS = Object.freeze({
  apiBase: `${String(CVB_API_ORIGIN).replace(/\/+$/, '')}/api`,
  webAppOrigin: 'https://resume-generator-live.vercel.app',
});
