const $ = (id) => document.getElementById(id);

const loginEl = $('login');
const mainEl = $('main');

const apiBaseEl = $('apiBase');
const emailEl = $('email');
const passwordEl = $('password');
const loginBtn = $('loginBtn');
const loginErr = $('loginErr');

const logoutBtn = $('logoutBtn');
const tabUrlEl = $('tabUrl');
const statusEl = $('status');
const msgEl = $('msg');

const saveLinkBtn = $('saveLinkBtn');
const openInAppBtn = $('openInAppBtn');

const profileSelect = $('profileSelect');
const setProfileBtn = $('setProfileBtn');

const jdText = $('jdText');
const saveJdBtn = $('saveJdBtn');

const generateBtn = $('generateBtn');
const downloadPdfBtn = $('downloadPdfBtn');
const downloadDocxBtn = $('downloadDocxBtn');
const autoUploadBtn = $('autoUploadBtn');

const tabGenerateBtn = $('tabGenerate');
const tabDownloadBtn = $('tabDownload');
const tabAiBtn = $('tabAi');
const panelGenerate = $('panelGenerate');
const panelDownload = $('panelDownload');
const panelAi = $('panelAi');

const aiChatBox = $('aiChatBox');
const aiQuestion = $('aiQuestion');
const aiAskBtn = $('aiAskBtn');

let state = {
  apiBase: '',
  token: '',
  user: null,
  tabUrl: '',
  link: null,
  profiles: [],
  aiHistory: [],
};

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = `statusBox ${cls || ''}`.trim();
}

function setMsg(text) {
  msgEl.textContent = text || '';
}

function setActiveTab(key) {
  const all = [
    { key: 'generate', btn: tabGenerateBtn, panel: panelGenerate },
    { key: 'download', btn: tabDownloadBtn, panel: panelDownload },
    { key: 'ai', btn: tabAiBtn, panel: panelAi },
  ];
  for (const t of all) {
    if (t.btn) t.btn.classList.toggle('active', t.key === key);
    if (t.btn) t.btn.setAttribute('aria-selected', t.key === key ? 'true' : 'false');
    if (t.panel) t.panel.classList.toggle('hidden', t.key !== key);
  }
}

function renderAiChat() {
  if (!aiChatBox) return;
  const msgs = Array.isArray(state.aiHistory) ? state.aiHistory : [];
  if (msgs.length === 0) {
    aiChatBox.innerHTML = `<div class="muted">No messages yet.</div>`;
    return;
  }
  aiChatBox.innerHTML = msgs
    .slice(-12)
    .map((m) => {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const cls = role === 'user' ? 'chatMsg me' : 'chatMsg';
      const hdr = role === 'user' ? 'You' : 'Assistant';
      const safe = String(m.content || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
      return `<div class="${cls}"><div class="chatHdr">${hdr}</div>${safe}</div>`;
    })
    .join('');
  aiChatBox.scrollTop = aiChatBox.scrollHeight;
}

function baseHostFromApiBase(apiBase) {
  // http://127.0.0.1:5000/api -> http://127.0.0.1:5000
  return String(apiBase || '').replace(/\/api\/?$/i, '');
}

async function apiFetch(path, opts = {}) {
  const url = `${state.apiBase}${path}`;
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : (typeof data === 'string' ? data : res.statusText);
    const err = new Error(msg || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Active tab URL for the browser window (side panel lives in the same window; fall back if needed). */
async function getActiveTabUrl() {
  try {
    const win = await chrome.windows.getCurrent();
    if (win?.id != null) {
      const [t] = await chrome.tabs.query({ active: true, windowId: win.id });
      if (t?.url) return t.url;
    }
  } catch {
    // ignore
  }
  const [t2] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (t2?.url) return t2.url;
  const [t3] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t3?.url || '';
}

let tabRefreshTimer = null;
let tabListenersInstalled = false;

function scheduleRefreshForActiveTab() {
  if (!state.token) return;
  if (mainEl.classList.contains('hidden')) return;
  clearTimeout(tabRefreshTimer);
  tabRefreshTimer = setTimeout(() => {
    checkCurrentUrl().catch((e) => setMsg(e.message || 'Refresh failed'));
  }, 200);
}

/** Re-check URL when the user switches tabs or the active tab navigates (incl. SPA URL changes). */
function installActiveTabListeners() {
  if (tabListenersInstalled) return;
  if (!chrome.tabs?.onActivated) return;
  tabListenersInstalled = true;

  chrome.tabs.onActivated.addListener(() => {
    scheduleRefreshForActiveTab();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete' && !changeInfo.url) return;
    (async () => {
      try {
        const win = await chrome.windows.getCurrent();
        if (win?.id == null) return;
        const [active] = await chrome.tabs.query({ active: true, windowId: win.id });
        if (active && active.id === tabId) scheduleRefreshForActiveTab();
      } catch {
        // ignore
      }
    })();
  });

  // Backup: background notifies when focus/tab changes (some Chrome builds are flaky for tabs events on side panels).
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type !== 'cvb-active-tab-changed') return;
      scheduleRefreshForActiveTab();
    });
  }
}

async function loadSession() {
  const stored = await chrome.storage.local.get(['apiBase', 'token', 'user']);
  state.apiBase = stored.apiBase || 'http://127.0.0.1:5000/api';
  state.token = stored.token || '';
  state.user = stored.user || null;
  apiBaseEl.value = state.apiBase;
}

async function saveSession() {
  await chrome.storage.local.set({ apiBase: state.apiBase, token: state.token, user: state.user });
}

async function clearSession() {
  state.token = '';
  state.user = null;
  await chrome.storage.local.remove(['token', 'user']);
}

function showLogin() {
  loginEl.classList.remove('hidden');
  mainEl.classList.add('hidden');
}

function showMain() {
  loginEl.classList.add('hidden');
  mainEl.classList.remove('hidden');
}

async function ensureLoggedIn() {
  if (!state.token) return false;
  try {
    await apiFetch('/auth/me', { method: 'GET' });
    return true;
  } catch {
    await clearSession();
    return false;
  }
}

async function refreshProfiles() {
  const profiles = await apiFetch('/profile', { method: 'GET' });
  state.profiles = Array.isArray(profiles) ? profiles : [];
  profileSelect.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = '— Select profile —';
  profileSelect.appendChild(opt0);
  for (const p of state.profiles) {
    const opt = document.createElement('option');
    opt.value = String(p._id);
    opt.textContent = p.label || p.name || p.email || String(p._id);
    profileSelect.appendChild(opt);
  }
}

async function checkCurrentUrl() {
  setMsg('');
  const prevUrl = state.tabUrl;
  state.tabUrl = await getActiveTabUrl();
  if (prevUrl && state.tabUrl && prevUrl !== state.tabUrl) {
    state.aiHistory = [];
    renderAiChat();
  }
  tabUrlEl.textContent = state.tabUrl || '—';
  if (!state.tabUrl || state.tabUrl.startsWith('chrome://') || state.tabUrl.startsWith('edge://')) {
    setStatus('This page cannot be accessed by extensions.', 'warn');
    return;
  }
  const resp = await apiFetch('/workspace-links/check-url', {
    method: 'POST',
    body: JSON.stringify({ url: state.tabUrl }),
  });
  if (!resp.exists) {
    state.link = null;
    setStatus('Not saved yet. Click “Save link”.', 'bad');
    downloadPdfBtn.disabled = true;
    downloadDocxBtn.disabled = true;
    autoUploadBtn.disabled = true;
    aiAskBtn.disabled = true;
    return;
  }
  state.link = resp.link;
  const s = state.link.cvStatus || 'not_started';
  const hasJd = !!state.link.hasJd;
  const hasProfile = !!state.link.hasProfile;
  const hasCv = !!state.link.cvId;

  if (hasCv) {
    setStatus(`Saved · JD ${hasJd ? '✓' : '✗'} · Profile ${hasProfile ? '✓' : '✗'} · CV available`, 'ok');
    downloadPdfBtn.disabled = false;
    downloadDocxBtn.disabled = false;
    autoUploadBtn.disabled = false;
    aiAskBtn.disabled = false;
  } else if (s === 'pending') {
    setStatus(`Saved · JD ${hasJd ? '✓' : '✗'} · Profile ${hasProfile ? '✓' : '✗'} · Generating…`, 'warn');
    downloadPdfBtn.disabled = true;
    downloadDocxBtn.disabled = true;
    autoUploadBtn.disabled = true;
    aiAskBtn.disabled = true;
  } else if (s === 'failed') {
    setStatus(`Saved · JD ${hasJd ? '✓' : '✗'} · Profile ${hasProfile ? '✓' : '✗'} · Generation failed`, 'bad');
    downloadPdfBtn.disabled = true;
    downloadDocxBtn.disabled = true;
    autoUploadBtn.disabled = true;
    aiAskBtn.disabled = true;
  } else {
    setStatus(`Saved · JD ${hasJd ? '✓' : '✗'} · Profile ${hasProfile ? '✓' : '✗'} · No CV yet`, 'warn');
    downloadPdfBtn.disabled = true;
    downloadDocxBtn.disabled = true;
    autoUploadBtn.disabled = true;
    aiAskBtn.disabled = true;
  }
}

async function askAi() {
  if (!state.link?.cvId) throw new Error('Generate a CV first.');
  const q = String(aiQuestion?.value || '').trim();
  if (!q) throw new Error('Type a question first.');

  state.aiHistory = [...(state.aiHistory || []), { role: 'user', content: q }].slice(-12);
  aiQuestion.value = '';
  renderAiChat();
  setMsg('Asking AI…');

  const data = await apiFetch('/ai/cv-chat', {
    method: 'POST',
    body: JSON.stringify({ cvId: state.link.cvId, message: q, history: state.aiHistory }),
  });

  const answer = String(data?.answer || '').trim() || '(No response)';
  state.aiHistory = [...(state.aiHistory || []), { role: 'assistant', content: answer }].slice(-12);
  renderAiChat();
  setMsg('');
}

async function saveLink() {
  setMsg('Saving link…');
  await apiFetch('/workspace-links', {
    method: 'POST',
    body: JSON.stringify({ sourceFileName: 'extension', urls: [state.tabUrl] }),
  });
  await checkCurrentUrl();
  setMsg('Saved.');
}

async function setProfile() {
  if (!state.link?._id) throw new Error('Save the link first.');
  const pid = profileSelect.value;
  if (!pid) throw new Error('Select a profile.');
  setMsg('Setting profile…');
  await apiFetch('/workspace-links/set-profile', {
    method: 'POST',
    body: JSON.stringify({ ids: [state.link._id], profileId: pid }),
  });
  await checkCurrentUrl();
  setMsg('Profile set.');
}

async function saveJd() {
  if (!state.link?._id) throw new Error('Save the link first.');
  setMsg('Saving JD…');
  await apiFetch('/workspace-links/set-jd', {
    method: 'POST',
    body: JSON.stringify({ id: state.link._id, jobDescription: jdText.value }),
  });
  await checkCurrentUrl();
  setMsg('JD saved.');
}

async function generateCv() {
  if (!state.link?._id) throw new Error('Save the link first.');
  // Require both JD and Profile for generation.
  const pid = profileSelect.value || state.link.profileId;
  if (!pid) throw new Error('Select a profile first.');
  const jd = String(jdText.value || '').trim();
  if (jd.length < 40) throw new Error('Paste a JD (min ~40 chars) first.');

  // Ensure link profile is set to avoid server default profile requirement.
  await apiFetch('/workspace-links/set-profile', {
    method: 'POST',
    body: JSON.stringify({ ids: [state.link._id], profileId: pid }),
  });
  await apiFetch('/workspace-links/set-jd', {
    method: 'POST',
    body: JSON.stringify({ id: state.link._id, jobDescription: jd }),
  });

  setMsg('Generating CV…');
  await apiFetch('/workspace-links/generate-cvs', {
    method: 'POST',
    body: JSON.stringify({
      ids: [state.link._id],
      profileId: '',
      jobDescriptionsByLinkId: { [state.link._id]: jd },
    }),
  });

  // Poll status
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    await checkCurrentUrl();
    if (state.link?.cvStatus === 'created' || state.link?.cvStatus === 'failed') break;
  }
  setMsg(state.link?.cvStatus === 'created' ? 'CV ready.' : 'Done.');
}

async function downloadCv(kind) {
  if (!state.link?.cvId) throw new Error('No CV id available yet.');
  const endpoint = kind === 'pdf' ? `/cv/${state.link.cvId}/download/pdf` : `/cv/${state.link.cvId}/download/docx`;
  const bust = `t=${Date.now()}`;
  setMsg(`Downloading ${kind.toUpperCase()}…`);
  // Ensure session is still valid (avoid confusing 500s on expired tokens).
  await apiFetch('/auth/me', { method: 'GET' });
  const res = await fetch(`${state.apiBase}${endpoint}?${bust}`, {
    headers: { Authorization: `Bearer ${state.token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    const msg = data?.error || text || `HTTP ${res.status}`;
    throw new Error(`Download failed: ${msg}`);
  }
  const cd = res.headers.get('content-disposition') || '';
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const filename = filenameFromContentDisposition(cd) || (kind === 'pdf' ? 'CV.pdf' : 'CV.docx');
  const safeFilename = sanitizeDownloadFilename(filename);

  // Prefer Chrome downloads API (reliable for repeat downloads even after async work).
  if (chrome.downloads?.download) {
    try {
      await downloadsDownload({ url: objUrl, filename: safeFilename });
      // Revoke after Chrome has time to start reading the blob URL.
      setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
      setMsg('Downloaded.');
      return;
    } catch {
      // fallback below
    }
  }

  // Fallback: anchor download (may be blocked depending on Chrome gesture rules).
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
  setMsg('Downloaded.');
}

async function autoUploadPdf() {
  if (!state.link?.cvId) throw new Error('No CV available yet.');
  const tabUrl = await getActiveTabUrl();
  if (!tabUrl) throw new Error('No active tab.');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab id.');

  setMsg('Scanning page for upload fields…');
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content/uploader.js'],
  });
  const scan = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_FILE_INPUTS' });
  if (!scan?.success) throw new Error(scan?.error || 'Failed to scan file inputs');
  if (!scan.inputs?.length) throw new Error('No file upload inputs found on this page.');

  setMsg('Downloading PDF…');
  const apiBase = state.apiBase.replace(/\/+$/, '');
  const bust = `t=${Date.now()}`;
  await apiFetch('/auth/me', { method: 'GET' });
  const res = await fetch(`${apiBase}/cv/${state.link.cvId}/download/pdf?${bust}`, {
    headers: { Authorization: `Bearer ${state.token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    const msg = data?.error || text || `HTTP ${res.status}`;
    throw new Error(`Download failed: ${msg}`);
  }
  const cd = res.headers.get('content-disposition') || '';
  const blob = await res.blob();

  const base64 = await blobToBase64(blob);
  const fileName = filenameFromContentDisposition(cd) || 'CV.pdf';

  setMsg('Uploading into the page…');
  const inputId = scan.inputs[0].input_id; // naive: first file input
  const up = await chrome.tabs.sendMessage(tab.id, {
    type: 'UPLOAD_FILE',
    inputId,
    fileData: base64,
    fileName,
  });
  if (!up?.success) throw new Error(up?.error || 'Upload failed');
  setMsg('Uploaded. If the site needs a submit, click it on the page.');
}

function filenameFromContentDisposition(headerValue) {
  const h = String(headerValue || '');
  if (!h) return '';
  // Try RFC 5987: filename*=UTF-8''...
  const mStar = h.match(/filename\*\s*=\s*([^;]+)/i);
  if (mStar) {
    let v = String(mStar[1] || '').trim();
    v = v.replace(/^UTF-8''/i, '');
    v = v.replace(/^"(.*)"$/, '$1');
    try {
      const decoded = decodeURIComponent(v);
      if (decoded) return decoded;
    } catch {
      if (v) return v;
    }
  }
  // Fallback: filename="..."
  const m = h.match(/filename\s*=\s*([^;]+)/i);
  if (m) {
    let v = String(m[1] || '').trim();
    v = v.replace(/^"(.*)"$/, '$1');
    if (v) return v;
  }
  return '';
}

function sanitizeDownloadFilename(name) {
  const s = String(name || '').trim() || 'CV.pdf';
  // downloads API expects a relative filename; strip any directory parts and illegal characters.
  const base = s.split(/[\\/]/).pop() || s;
  return base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function downloadsDownload({ url, filename }) {
  return new Promise((resolve, reject) => {
    try {
      chrome.downloads.download(
        {
          url,
          filename,
          conflictAction: 'uniquify',
          saveAs: false,
        },
        (downloadId) => {
          const err = chrome.runtime?.lastError;
          if (err) return reject(new Error(err.message || 'Download failed'));
          if (!downloadId) return reject(new Error('Download failed'));
          resolve(downloadId);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function openInApp() {
  const base = baseHostFromApiBase(state.apiBase);
  const url = state.link?.cvId ? `${base}/cv/${state.link.cvId}` : `${base}/workspace`;
  await chrome.tabs.create({ url });
}

loginBtn.addEventListener('click', async () => {
  loginErr.textContent = '';
  loginBtn.disabled = true;
  try {
    state.apiBase = String(apiBaseEl.value || '').trim().replace(/\/+$/, '');
    const res = await fetch(`${state.apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailEl.value.trim(), password: passwordEl.value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    state.token = data.token;
    state.user = data.user;
    await saveSession();
    await initMain();
  } catch (e) {
    loginErr.textContent = e.message || 'Login failed';
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  await clearSession();
  showLogin();
});

saveLinkBtn.addEventListener('click', () => run(saveLink));
openInAppBtn.addEventListener('click', () => run(openInApp));
setProfileBtn.addEventListener('click', () => run(setProfile));
saveJdBtn.addEventListener('click', () => run(saveJd));
generateBtn.addEventListener('click', () => run(generateCv));
downloadPdfBtn.addEventListener('click', () => run(() => downloadCv('pdf')));
downloadDocxBtn.addEventListener('click', () => run(() => downloadCv('docx')));
autoUploadBtn.addEventListener('click', () => run(autoUploadPdf));
aiAskBtn.addEventListener('click', () => run(askAi));

tabGenerateBtn?.addEventListener('click', () => setActiveTab('generate'));
tabDownloadBtn?.addEventListener('click', () => setActiveTab('download'));
tabAiBtn?.addEventListener('click', () => setActiveTab('ai'));

async function run(fn) {
  setMsg('');
  try {
    await fn();
  } catch (e) {
    setMsg(e.message || 'Error');
  }
}

async function initMain() {
  showMain();
  installActiveTabListeners();
  setActiveTab('generate');
  await refreshProfiles();
  await checkCurrentUrl();
  renderAiChat();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSession();
  const ok = await ensureLoggedIn();
  if (!ok) {
    showLogin();
    return;
  }
  await initMain();
});

