const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

function extensionRootDir() {
  // project root: one level above /server
  return path.join(__dirname, '..', '..', 'extension-cv-builder');
}

// GET /api/extension/cv-builder-zip
exports.downloadCvBuilderZip = async (req, res) => {
  const srcDir = extensionRootDir();
  if (!fs.existsSync(srcDir)) {
    return res.status(404).json({ error: 'extension-cv-builder folder not found' });
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

  // If client aborts, stop archiving.
  res.on('close', () => {
    try {
      archive.abort();
    } catch {
      // ignore
    }
  });

  archive.pipe(res);

  // Put everything under a single top-level folder in the zip.
  archive.glob('**/*', {
    cwd: srcDir,
    dot: true,
    ignore: ['**/node_modules/**', '**/.git/**', '**/.DS_Store'],
  }, { prefix: 'extension-cv-builder' });

  await archive.finalize();
};

