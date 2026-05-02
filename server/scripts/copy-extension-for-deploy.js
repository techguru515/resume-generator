/**
 * Option B: bundle extension into server/extension-cv-builder for hosted APIs
 * that only run from the server/ directory.
 *
 * Copies from repo root ../extension-cv-builder (when present). Safe no-op if missing.
 *
 * Keep server/extension-cv-builder/ OFF .gitignore: some hosts omit ignored paths from the deploy
 * artifact. Prefer committing only repo-root extension-cv-builder; avoid `git add` of this bundle.
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..');
const repoRoot = path.join(serverDir, '..');
const src = process.env.EXTENSION_COPY_SOURCE
  ? path.resolve(process.env.EXTENSION_COPY_SOURCE)
  : path.join(repoRoot, 'extension-cv-builder');
const dest = path.join(serverDir, 'extension-cv-builder');

function main() {
  if (!fs.existsSync(src)) {
    console.log(
      '[copy-extension] Source not found, skipping:',
      src,
      '(set EXTENSION_COPY_SOURCE or keep monorepo layout)'
    );
    return;
  }
  const stat = fs.statSync(src);
  if (!stat.isDirectory()) {
    console.warn('[copy-extension] Source is not a directory:', src);
    return;
  }

  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log('[copy-extension] Copied extension →', dest);
}

main();
