const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function getDefaultCvSaveDir() {
  return path.join(PROJECT_ROOT, 'cv');
}

/** Drive letter (D:\...) or UNC (\\server\share\...) — only valid absolute roots on Windows. */
function looksLikeWindowsAbsolutePath(p) {
  const s = String(p || '').trim();
  if (/^[A-Za-z]:[\\/]/.test(s)) return true;
  if (s.startsWith('\\\\')) return true;
  return false;
}

/**
 * Resolves where server-side CV download copies are written for this profile.
 * Empty / omitted cvSaveFolder → default project-root ./cv
 * Absolute paths → normalized as-is (for local disks or mounted volumes).
 * Relative paths → resolved under PROJECT_ROOT; must not escape (no "..").
 *
 * Important: On Linux/macOS, Node treats "D:/path" as NON-absolute and would resolve it under
 * the project root (e.g. /app/D:/path). Windows-style paths must only be used when the API runs on Windows.
 */
function resolveCvSaveDir(profile) {
  const raw = profile?.cvSaveFolder != null ? String(profile.cvSaveFolder).trim() : '';
  if (!raw) return getDefaultCvSaveDir();

  if (raw.includes('\0')) throw new Error('Invalid CV save folder path');

  if (looksLikeWindowsAbsolutePath(raw)) {
    if (process.platform !== 'win32') {
      throw new Error(
        'This API is running on a non-Windows server: Windows paths like D:\\… or \\\\server\\share\\… are not supported. Use a Unix path (e.g. /var/cvs) or a folder relative to the project root.'
      );
    }
    return path.normalize(raw);
  }

  let resolved;
  if (path.isAbsolute(raw)) {
    resolved = path.normalize(raw);
  } else {
    resolved = path.normalize(path.resolve(PROJECT_ROOT, raw));
    const rel = path.relative(PROJECT_ROOT, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('Relative CV save folder must stay inside the project directory');
    }
  }

  return resolved;
}

module.exports = { resolveCvSaveDir, getDefaultCvSaveDir, PROJECT_ROOT };
