const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

/**
 * Resolve folder containing the unpacked Chrome extension (manifest.json at root of that folder).
 * Order: EXTENSION_SOURCE_DIR → server/extension-cv-builder → repo/extension-cv-builder
 */
function resolveExtensionSourceDir() {
  const envPath = process.env.EXTENSION_SOURCE_DIR;
  if (envPath && fs.existsSync(envPath)) return path.resolve(envPath);

  const insideServer = path.join(__dirname, '..', 'extension-cv-builder');
  if (fs.existsSync(insideServer)) return insideServer;

  const siblingOfServer = path.join(__dirname, '..', '..', 'extension-cv-builder');
  if (fs.existsSync(siblingOfServer)) return siblingOfServer;

  return null;
}

function extensionUnavailableMessage() {
  return (
    'Extension ZIP is not bundled on this host. Fix: deploy the extension folder or set EXTENSION_ZIP_PATH / EXTENSION_SOURCE_DIR. ' +
      'See server/.env.example.'
  );
}

// GET /api/extension/cv-builder-zip
exports.downloadCvBuilderZip = async (req, res) => {
  const zipFromEnv = process.env.EXTENSION_ZIP_PATH;
  if (zipFromEnv) {
    const absZip = path.resolve(zipFromEnv);
    if (fs.existsSync(absZip) && fs.statSync(absZip).isFile()) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="extension-cv-builder.zip"');
      return fs.createReadStream(absZip).pipe(res);
    }
  }

  const srcDir = resolveExtensionSourceDir();
  if (!srcDir) {
    return res.status(503).json({ error: extensionUnavailableMessage() });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="extension-cv-builder.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    console.error('extension zip archive error:', err?.stack || err);
    try {
      if (!res.headersSent) res.status(500);
      res.end(JSON.stringify({ error: err?.message || 'Failed to create zip' }));
    } catch {
      // ignore
    }
  });

  res.on('close', () => {
    try {
      archive.abort();
    } catch {
      // ignore
    }
  });

  archive.pipe(res);

  archive.glob(
    '**/*',
    {
      cwd: srcDir,
      dot: true,
      ignore: ['**/node_modules/**', '**/.git/**', '**/.DS_Store'],
    },
    { prefix: 'extension-cv-builder' }
  );

  await archive.finalize();
};
