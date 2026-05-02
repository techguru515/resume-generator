// Minimal background worker: keep badge updated on tab changes.
importScripts('../defaults.js');

const FALLBACK = globalThis.CVB_DEFAULTS || {
  apiBase: 'https://resume-generator-production-b138.up.railway.app/api',
  webAppOrigin: 'https://resume-generator-live.vercel.app',
};

chrome.runtime.onInstalled.addListener(() => {
  try {
    // Open the side panel when the extension icon is clicked.
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    // ignore (older Chrome versions)
  }

  try {
    const s = await chrome.storage.local.get(['apiBase']);
    if (!s.apiBase) {
      await chrome.storage.local.set({
        apiBase: FALLBACK.apiBase,
        webAppOrigin: FALLBACK.webAppOrigin,
      });
    }
  } catch {
    // ignore
  }
});

async function getSession() {
  const { apiBase, token } = await chrome.storage.local.get(['apiBase', 'token']);
  return {
    apiBase: apiBase || FALLBACK.apiBase,
    token: token || '',
  };
}

function normalizeApiBase(apiBase) {
  return String(apiBase || '').trim().replace(/\/+$/, '');
}

async function checkUrl(apiBase, token, url) {
  const res = await fetch(`${normalizeApiBase(apiBase)}/workspace-links/check-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function updateBadgeForTab(tabId, url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('edge://')) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const { apiBase, token } = await getSession();
  if (!token) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const r = await checkUrl(apiBase, token, url);
  if (!r || !r.exists || !r.link) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const s = String(r.link.cvStatus || '');
  if (s === 'created') {
    await chrome.action.setBadgeText({ tabId, text: 'CV' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' });
  } else if (r.link.hasJd) {
    await chrome.action.setBadgeText({ tabId, text: 'JD' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#f59e0b' });
  } else {
    await chrome.action.setBadgeText({ tabId, text: '⨯' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#ef4444' });
  }
}

function notifyPanelActiveTabChanged() {
  try {
    chrome.runtime.sendMessage({ type: 'cvb-active-tab-changed' }).catch(() => {});
  } catch {
    // ignore
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await updateBadgeForTab(tabId, tab?.url);
    notifyPanelActiveTabChanged();
  } catch {
    // ignore
  }
});

// complete: initial load. url: in-page / SPA navigation without a full reload.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' && !changeInfo.url) return;
  try {
    const u = tab?.url;
    await updateBadgeForTab(tabId, u);
    const t = await chrome.tabs.get(tabId);
    if (t?.active) notifyPanelActiveTabChanged();
  } catch {
    // ignore
  }
});

