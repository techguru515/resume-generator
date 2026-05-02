/**
 * Hosted deployment defaults for the unpacked extension.
 * Fork / self-host: edit `apiBase` (must end with /api) and `webAppOrigin` (SPA, no trailing slash).
 */
globalThis.CVB_DEFAULTS = Object.freeze({
  apiBase: 'https://resume-generator-production-b138.up.railway.app/api',
  webAppOrigin: 'https://resume-generator-live.vercel.app',
});
