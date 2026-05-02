const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function getDefaultCvSaveDir() {
  return path.join(PROJECT_ROOT, 'cv');
}

/**
 * Resolves where server-side CV download copies are written for this profile.
 * Empty / omitted cvSaveFolder → default project-root ./cv
 * Absolute paths → normalized as-is (for local disks or mounted volumes).
 * Relative paths → resolved under PROJECT_ROOT; must not escape (no "..").
 */
function resolveCvSaveDir(profile) {
  const raw = profile?.cvSaveFolder != null ? String(profile.cvSaveFolder).trim() : '';
  if (!raw) return getDefaultCvSaveDir();

  if (raw.includes('\0')) throw new Error('Invalid CV save folder path');

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
