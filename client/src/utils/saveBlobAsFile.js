/**
 * Save a Blob to disk via the OS "Save As" dialog when supported (Chrome, Edge — secure contexts),
 * otherwise fall back to a programmatic Download (browser default location / settings).
 *
 * Browsers do not allow a website to silently write to an arbitrary path like D:\Data\CVs.
 */

function triggerAnchorDownload(blob, filename) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/**
 * @param {Blob} blob
 * @param {string} suggestedName
 * @param {{ mime?: string; usePickerFirst?: boolean }} [opts]
 * @returns {Promise<{ ok: boolean; via: 'picker' | 'anchor' | 'aborted' }>}
 */
export async function saveBlobAsFile(blob, suggestedName, opts = {}) {
  const { mime, usePickerFirst = true } = opts;
  const canPicker =
    usePickerFirst &&
    typeof window !== 'undefined' &&
    typeof window.showSaveFilePicker === 'function';

  if (!canPicker) {
    triggerAnchorDownload(blob, suggestedName);
    return { ok: true, via: 'anchor' };
  }

  const extMatch = /\.[a-z0-9]+$/i.exec(suggestedName);
  const ext = extMatch ? extMatch[0].toLowerCase() : '';

  let types;
  if (mime) {
    types = [
      {
        description: ext === '.pdf' ? 'PDF' : ext === '.docx' ? 'Word document' : 'File',
        accept: ext ? { [mime]: [ext] } : { [mime]: [] },
      },
    ];
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types,
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true, via: 'picker' };
  } catch (e) {
    if (e?.name === 'AbortError')
      return { ok: false, via: 'aborted' };

    triggerAnchorDownload(blob, suggestedName);
    return { ok: true, via: 'anchor' };
  }
}

export function mimeForDownloadFilename(filename) {
  const f = String(filename || '').toLowerCase();
  if (f.endsWith('.pdf')) return 'application/pdf';
  if (f.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return '';
}
