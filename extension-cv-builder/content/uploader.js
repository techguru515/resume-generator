/**
 * Content script: scan upload inputs + programmatically attach file blobs.
 *
 * Messages:
 * - { type: 'SCAN_FILE_INPUTS' } -> { success, inputs: [{ input_id, name, accept, type }] }
 * - { type: 'UPLOAD_FILE', inputId, fileData(base64), fileName } -> { success }
 */

(() => {
  'use strict';

  function allFileInputs() {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    return inputs.filter((el) => {
      try {
        return !el.disabled;
      } catch {
        return false;
      }
    });
  }

  function describeInput(el, idx) {
    return {
      input_id: `file-${idx}`,
      name: el.getAttribute('name') || '',
      accept: el.getAttribute('accept') || '',
      type: 'file',
    };
  }

  async function base64ToFile(base64, fileName, mimeType) {
    const bin = atob(base64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], fileName, { type: mimeType || 'application/pdf' });
  }

  async function attachFileToInput(inputEl, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    inputEl.files = dt.files;
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        if (msg?.type === 'SCAN_FILE_INPUTS') {
          const inputs = allFileInputs();
          const out = inputs.map(describeInput);
          sendResponse({ success: true, inputs: out });
          return;
        }

        if (msg?.type === 'UPLOAD_FILE') {
          const { inputId, fileData, fileName } = msg || {};
          const inputs = allFileInputs();
          const idx = Number(String(inputId || '').replace(/^file-/, ''));
          const el = inputs[idx];
          if (!el) {
            sendResponse({ success: false, error: 'File input not found' });
            return;
          }
          const file = await base64ToFile(String(fileData || ''), String(fileName || 'CV.pdf'), 'application/pdf');
          await attachFileToInput(el, file);
          sendResponse({ success: true });
          return;
        }

        sendResponse({ success: false, error: 'Unknown message' });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  });
})();

