import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  listProfiles,
  listCVs,
  deleteCV,
  listWorkspaceLinks,
  saveWorkspaceLinks,
  deleteWorkspaceLinks,
  generateCvsForWorkspaceLinks,
  setProfileForWorkspaceLinks,
  setJobDescriptionForWorkspaceLink,
  apiPublicUrl,
} from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Pagination from '../components/Pagination.jsx';
import { profileRefToIdString, profileRefToLabel } from '../utils/profileRef.js';

const STATUS_CONFIG = {
  saved:     { label: 'Created',   badge: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  applied:   { label: 'Applied',   badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  interview: { label: 'Interview', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  offer:     { label: 'Offer',     badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  failed:    { label: 'Failed',    badge: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-500' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.saved;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function LinkSelectIcon({ checked, indeterminate = false }) {
  const boxClass = checked
    ? 'border-accent bg-accent text-white shadow-sm'
    : indeterminate
      ? 'border-accent bg-blue-50 text-accent shadow-sm'
      : 'border-gray-300 bg-white text-gray-400 hover:border-primary/50 hover:bg-slate-50';
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition ${boxClass}`} aria-hidden>
      {indeterminate ? (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 12h12" />
        </svg>
      ) : checked ? (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg className="w-3 h-3 opacity-35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}

function FunnelIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
    </svg>
  );
}

function openCvInNewWindow(cvId) {
  window.open(`/cv/${cvId}`, '_blank', 'noopener,noreferrer');
}

function isLinkedInUrl(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    const host = (u.hostname || '').toLowerCase();
    return host === 'linkedin.com' || host.endsWith('.linkedin.com') || host === 'lnkd.in';
  } catch {
    const low = s.toLowerCase();
    return low.includes('linkedin.com') || low.includes('lnkd.in');
  }
}

function escapeHtmlAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function TrashIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  );
}

function failedCvHoverText(row) {
  const err = String(row?.cvError || '').trim();
  let t = err;
  if (!t) {
    const hist = Array.isArray(row?.cvErrorHistory) ? row.cvErrorHistory : [];
    const last = hist.length ? hist[hist.length - 1] : null;
    t = last?.message ? String(last.message).trim() : '';
  }
  if (!t) return 'CV generation failed.';
  return t.length > 4000 ? `${t.slice(0, 3997)}…` : t;
}

function CvCreateBadge({ status, errorTitle }) {
  const s = String(status || 'not_started');
  const cfg = {
    not_started: { label: 'Empty', cls: 'bg-gray-100 text-gray-600' },
    pending: { label: 'Creating…', cls: 'bg-blue-100 text-blue-700' },
    created: { label: 'Created', cls: 'bg-emerald-100 text-emerald-800' },
    failed: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
  }[s] || { label: 'Empty', cls: 'bg-gray-100 text-gray-600' };

  const tip = s === 'failed' && errorTitle ? String(errorTitle) : undefined;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls} ${s === 'failed' && tip ? 'cursor-help' : ''}`}
      title={tip}
    >
      {cfg.label}
    </span>
  );
}

/** Pipeline order for CV status column sort */
const LINK_CV_STATUS_RANK = {
  not_started: 0,
  pending: 1,
  created: 2,
  failed: 3,
};

/** CV status only; used with CV status filter dropdown */
function compareCvStatusWithMode(a, b, mode) {
  const empty = (r) => !r.cvStatus || r.cvStatus === 'not_started';
  const aE = empty(a);
  const bE = empty(b);
  const raw = () => {
    const ra = LINK_CV_STATUS_RANK[String(a.cvStatus || 'not_started')] ?? 99;
    const rb = LINK_CV_STATUS_RANK[String(b.cvStatus || 'not_started')] ?? 99;
    return ra - rb;
  };
  if (mode === 'absentLast') {
    if (aE && !bE) return 1;
    if (!aE && bE) return -1;
    if (aE && bE) return 0;
    return -raw();
  }
  if (mode === 'absentFirst') {
    if (aE && !bE) return -1;
    if (!aE && bE) return 1;
    if (aE && bE) return 0;
    return raw();
  }
  const r = raw();
  return mode === 'desc' ? -r : r;
}

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 25, 50];
const DEFAULT_PAGE_SIZE = 8;

const ACCEPT_UPLOAD =
  '.pdf,.doc,.docx,.txt,.html,.htm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/html';

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatLinkDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatUpdatedCell(row) {
  if (row.isDuplicate) {
    return formatLinkDate(row.updatedAt || row.createdAt);
  }
  return '—';
}

/** Pull http(s) URLs from plain text (also works on raw bytes interpreted as Latin-1 for PDF/DOCX). */
function extractUrlsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const re = /https?:\/\/[^\s\]<>"{}|\\^`\[\]]+/gi;
  const seen = new Set();
  const out = [];
  for (const m of text.matchAll(re)) {
    let url = m[0].replace(/[,;.:)]+$/g, '').replace(/\]+$/g, '');
    try {
      const parsed = new URL(url);
      const norm = parsed.toString();
      if (!seen.has(norm)) {
        seen.add(norm);
        out.push(norm);
      }
    } catch {
      if (url.length > 11 && !seen.has(url)) {
        seen.add(url);
        out.push(url);
      }
    }
  }
  return out;
}

function bytesToLatin1Slice(bytes, maxBytes) {
  const n = Math.min(bytes.length, maxBytes);
  let s = '';
  const step = 16384;
  for (let i = 0; i < n; i += step) {
    const end = Math.min(i + step, n);
    for (let j = i; j < end; j++) s += String.fromCharCode(bytes[j]);
  }
  return s;
}

async function extractUrlsFromFile(file) {
  const name = (file.name || '').toLowerCase();
  const mime = file.type || '';

  const asText =
    mime.startsWith('text/')
    || /\.(txt|md|csv|html?|htm|json|xml|log)$/i.test(name);

  if (asText) {
    const text = await file.text();
    return extractUrlsFromText(text);
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const maxScan = Math.min(bytes.length, 4 * 1024 * 1024);
  const raw = bytesToLatin1Slice(bytes, maxScan);
  return extractUrlsFromText(raw);
}

export default function Workspace() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [profiles, setProfiles] = useState([]);
  const [downloadingExtension, setDownloadingExtension] = useState(false);

  const [savedLinks, setSavedLinks] = useState([]);
  const [loadingSavedLinks, setLoadingSavedLinks] = useState(true);
  const [linksError, setLinksError] = useState('');

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  const [cvList, setCvList] = useState([]);
  const [loadingCvs, setLoadingCvs] = useState(true);
  const [deletingCvId, setDeletingCvId] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableProfileFilter, setTableProfileFilter] = useState('all');
  const [cvDateFrom, setCvDateFrom] = useState(''); // yyyy-mm-dd
  const [cvDateTo, setCvDateTo] = useState(''); // yyyy-mm-dd
  const [linkSearch, setLinkSearch] = useState('');
  const [linkDateFrom, setLinkDateFrom] = useState(''); // yyyy-mm-dd
  const [linkDateTo, setLinkDateTo] = useState(''); // yyyy-mm-dd
  const [linkCvStatusFilter, setLinkCvStatusFilter] = useState('all');
  const [linkProfileFilter, setLinkProfileFilter] = useState('all'); // 'all' | 'none' | profileId
  const [linkTypeFilter, setLinkTypeFilter] = useState('all'); // 'all' | 'linkedin' | 'other'
  const [linkJdFilter, setLinkJdFilter] = useState('all'); // 'all' | 'has' | 'missing'
  const [linkSourceFileFilter, setLinkSourceFileFilter] = useState('all'); // 'all' | sourceFileName
  const [openLinkHeaderFilter, setOpenLinkHeaderFilter] = useState(''); // '' | 'profile' | 'type' | 'cvStatus' | 'jd'
  const [linkPage, setLinkPage] = useState(1);
  const [cvPage, setCvPage] = useState(1);
  const [linkPageSize, setLinkPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [cvPageSize, setCvPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [workspaceTableTab, setWorkspaceTableTab] = useState('links'); // 'links' | 'cvs'

  const [selectedLinkIds, setSelectedLinkIds] = useState([]);
  const [deletingLinks, setDeletingLinks] = useState(false);
  const [generatingLinks, setGeneratingLinks] = useState(false);
  /** Last bulk Generate CV result (partial success supported); failures list every link error. */
  const [lastBulkGenResult, setLastBulkGenResult] = useState(null);
  const [updatingProfileLinkIds, setUpdatingProfileLinkIds] = useState([]);
  const linkSelectAllRef = useRef(null);

  const [manualUrl, setManualUrl] = useState('');
  const [creatingManualLink, setCreatingManualLink] = useState(false);

  const [jdOpenLinkId, setJdOpenLinkId] = useState('');
  const [jdByLinkId, setJdByLinkId] = useState({});
  const [savingJdLinkIds, setSavingJdLinkIds] = useState([]);
  const [jdSaveErrorByLinkId, setJdSaveErrorByLinkId] = useState({});
  const jdSaveTimersRef = useRef({});

  useEffect(() => {
    listProfiles()
      .then((data) => {
        setProfiles(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.isApproved && user?.role !== 'admin') {
      setLoadingSavedLinks(false);
      return;
    }
    setLoadingSavedLinks(true);
    setLinksError('');
    listWorkspaceLinks()
      .then((d) => setSavedLinks(Array.isArray(d) ? d : []))
      .catch(() => setSavedLinks([]))
      .finally(() => setLoadingSavedLinks(false));
  }, [user]);

  // Hydrate local JD cache from DB (without overwriting local edits).
  useEffect(() => {
    if (!Array.isArray(savedLinks) || savedLinks.length === 0) return;
    setJdByLinkId((prev) => {
      const next = { ...prev };
      for (const l of savedLinks) {
        const id = String(l?._id || '');
        if (!id) continue;
        if (next[id] != null) continue;
        const txt = l?.jobDescriptionId?.text;
        if (txt) next[id] = String(txt);
      }
      return next;
    });
  }, [savedLinks]);

  useEffect(() => {
    if (!user?.isApproved && user?.role !== 'admin') return;
    listCVs()
      .then(setCvList)
      .catch(() => setCvList([]))
      .finally(() => setLoadingCvs(false));
  }, [user]);

  async function deleteCvById(cvId) {
    const id = String(cvId || '');
    if (!id) return;
    setDeletingCvId(id);
    try {
      await deleteCV(id);
      const fresh = await listCVs();
      setCvList(Array.isArray(fresh) ? fresh : []);
    } catch (err) {
      setLinksError(err.response?.data?.error || err.message || 'Failed to delete CV');
    } finally {
      setDeletingCvId('');
    }
  }

  const addFiles = useCallback((fileList) => {
    setLinksError('');
    const arr = Array.from(fileList || []);
    const next = arr.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'unknown',
      urls: [],
      extracting: true,
    }));
    setUploadedFiles((prev) => [...prev, ...next]);

    next.forEach((item) => {
      extractUrlsFromFile(item.file)
        .then(async (urls) => {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, urls, extracting: false } : f))
          );
          if (urls.length === 0) return;
          try {
            await saveWorkspaceLinks({
              sourceFileName: item.name,
              urls,
            });
            const fresh = await listWorkspaceLinks();
            setSavedLinks(Array.isArray(fresh) ? fresh : []);
          } catch (err) {
            setLinksError(err.response?.data?.error || err.message || 'Failed to save links');
          }
        })
        .catch(() => {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, urls: [], extracting: false } : f))
          );
        });
    });
  }, []);

  function removeUploaded(id) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  }

  function handleFileInput(e) {
    addFiles(e.target.files);
    e.target.value = '';
  }

  async function downloadExtensionZip() {
    setDownloadingExtension(true);
    try {
      const token = localStorage.getItem('token');
      const url = apiPublicUrl('/extension/cv-builder-zip');
      const res = await fetch(url, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = text || `HTTP ${res.status}`;
        try {
          const j = text ? JSON.parse(text) : null;
          if (j?.error) msg = j.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const looksZip =
        ct.includes('zip') || ct.includes('octet-stream') || ct.includes('x-zip');
      if (!looksZip) {
        const text = await res.text().catch(() => '');
        let msg = 'Server did not return a ZIP file.';
        try {
          const j = text ? JSON.parse(text) : null;
          if (j?.error) msg = j.error;
          else if (text) msg = text.slice(0, 300);
        } catch {
          if (text) msg = text.slice(0, 300);
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = 'extension-cv-builder.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      alert(err?.message || 'Could not download extension. If you use a hosted API, the server must include the extension files or EXTENSION_ZIP_PATH.');
    } finally {
      setDownloadingExtension(false);
    }
  }

  const profileLabelById = useMemo(
    () => Object.fromEntries(profiles.map((p) => [String(p._id), p.label])),
    [profiles]
  );

  const filteredCvs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cvList.filter((cv) => {
      const createdMs = new Date(cv.createdAt || 0).getTime();
      if (!Number.isFinite(createdMs) || createdMs <= 0) return false;

      const fromMs = cvDateFrom ? new Date(`${cvDateFrom}T00:00:00`).getTime() : null;
      const toMs = cvDateTo ? new Date(`${cvDateTo}T23:59:59.999`).getTime() : null;
      if (fromMs != null && Number.isFinite(fromMs) && createdMs < fromMs) return false;
      if (toMs != null && Number.isFinite(toMs) && createdMs > toMs) return false;

      const pid = profileRefToIdString(cv.profileId);
      if (tableProfileFilter !== 'all' && pid !== tableProfileFilter) return false;
      const st = cv.application_status || 'saved';
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (q) {
        const profLabel = profileRefToLabel(cv.profileId, profileLabelById).toLowerCase();
        const hay = [cv.role_title, cv.company_name, cv.job_type, cv.remote_status, cv.salary_range, profLabel]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cvList, search, statusFilter, tableProfileFilter, cvDateFrom, cvDateTo, profileLabelById]);

  const linkTableRows = useMemo(() => {
    const list = Array.isArray(savedLinks) ? savedLinks : [];
    const q = linkSearch.trim().toLowerCase();

    function dateRangeOk(rowCreatedAt) {
      const t = new Date(rowCreatedAt || 0).getTime();
      if (!Number.isFinite(t) || t <= 0) return false;

      // Parse yyyy-mm-dd in local time.
      const fromMs = linkDateFrom ? new Date(`${linkDateFrom}T00:00:00`).getTime() : null;
      const toMs = linkDateTo ? new Date(`${linkDateTo}T23:59:59.999`).getTime() : null;

      if (fromMs != null && Number.isFinite(fromMs) && t < fromMs) return false;
      if (toMs != null && Number.isFinite(toMs) && t > toMs) return false;
      return true;
    }

    const rows = list
      .filter((row) => {
        if (!dateRangeOk(row.createdAt)) return false;

        if (linkSourceFileFilter !== 'all') {
          const sf = String(row.sourceFileName || '');
          if (sf !== linkSourceFileFilter) return false;
        }

        const st = String(row.cvStatus || 'not_started');
        if (linkCvStatusFilter !== 'all' && st !== linkCvStatusFilter) return false;

        if (linkJdFilter !== 'all') {
          const sid = String(row?._id || '');
          const jdText = jdByLinkId?.[sid] != null ? jdByLinkId[sid] : row?.jobDescriptionId?.text;
          const hasJd = Boolean(String(jdText || '').trim());
          if (linkJdFilter === 'has' && !hasJd) return false;
          if (linkJdFilter === 'missing' && hasJd) return false;
        }

        const pid = profileRefToIdString(row.profileId);
        if (linkProfileFilter !== 'all') {
          if (linkProfileFilter === 'none') {
            if (pid) return false;
          } else if (pid !== linkProfileFilter) {
            return false;
          }
        }

        const t = isLinkedInUrl(row.url) ? 'linkedin' : 'other';
        if (linkTypeFilter !== 'all' && t !== linkTypeFilter) return false;

        if (!q) return true;
        const url = (row.url || '').toLowerCase();
        const fname = (row.sourceFileName || '').toLowerCase();
        const pl = String(profileRefToLabel(row.profileId, profileLabelById) || '').toLowerCase();
        return url.includes(q) || fname.includes(q) || pl.includes(q);
      })
      .map((row) => ({
        key: row._id,
        fileName: row.sourceFileName,
        url: row.url,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        // Duplicate only when the same normalized URL is saved again (server sets isDuplicate).
        isDuplicate: row.isDuplicate === true,
        profileId: row.profileId,
        cvStatus: row.cvStatus || 'not_started',
        cvError: String(row.cvError || '').trim(),
        cvErrorHistory: Array.isArray(row.cvErrorHistory) ? row.cvErrorHistory : [],
        cvId: row.cvId || null,
        linkType: isLinkedInUrl(row.url) ? 'linkedin' : 'other',
      }));

    /** Newest created first; ties break by newest updated */
    const defaultLinkOrder = (a, b) => {
      const ca = new Date(a.createdAt || 0).getTime();
      const cb = new Date(b.createdAt || 0).getTime();
      if (cb !== ca) return cb - ca;
      return (
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    };

    rows.sort(defaultLinkOrder);
    return rows;
  }, [savedLinks, linkSearch, linkDateFrom, linkDateTo, linkCvStatusFilter, linkProfileFilter, linkTypeFilter, linkJdFilter, linkSourceFileFilter, jdByLinkId, profileLabelById]);

  const sortedFilteredCvs = useMemo(() => {
    const rows = [...filteredCvs];
    rows.sort((a, b) => {
      // Fixed ordering: newest updated first (ties: newest created).
      const ua = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const ub = new Date(b.updatedAt || b.createdAt || 0).getTime();
      if (ub !== ua) return ub - ua;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    return rows;
  }, [filteredCvs]);

  const anyLinkExtracting = uploadedFiles.some((f) => f.extracting);

  useEffect(() => {
    const valid = new Set((Array.isArray(savedLinks) ? savedLinks : []).map((l) => String(l._id)));
    setSelectedLinkIds((prev) => prev.filter((id) => valid.has(String(id))));
  }, [savedLinks]);

  useEffect(() => {
    setLinkPage(1);
  }, [linkSearch, linkDateFrom, linkDateTo, linkCvStatusFilter, linkProfileFilter, linkTypeFilter, linkJdFilter, linkSourceFileFilter, linkPageSize]);

  useEffect(() => {
    const tp = Math.ceil(linkTableRows.length / linkPageSize) || 1;
    setLinkPage((p) => Math.min(p, Math.max(1, tp)));
  }, [linkTableRows.length, linkPageSize]);

  useEffect(() => {
    setCvPage(1);
  }, [search, statusFilter, tableProfileFilter, cvDateFrom, cvDateTo, cvPageSize]);

  useEffect(() => {
    const tp = Math.ceil(sortedFilteredCvs.length / cvPageSize) || 1;
    setCvPage((p) => Math.min(p, Math.max(1, tp)));
  }, [sortedFilteredCvs.length, cvPageSize]);

  const paginatedLinkRows = useMemo(() => {
    const start = (linkPage - 1) * linkPageSize;
    return linkTableRows.slice(start, start + linkPageSize);
  }, [linkTableRows, linkPage, linkPageSize]);

  const selectedLinkSet = useMemo(() => new Set(selectedLinkIds.map(String)), [selectedLinkIds]);

  const exportSelectedLinkUrls = useCallback(() => {
    const urlById = new Map(
      (Array.isArray(savedLinks) ? savedLinks : []).map((l) => [String(l._id), String(l.url || '').trim()])
    );
    const urls = selectedLinkIds.map((id) => urlById.get(String(id))).filter((u) => u && u.length > 0);
    if (urls.length === 0) {
      window.alert('No URLs found for the selected links.');
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const items = urls
      .map((u) => {
        const href = escapeHtmlAttr(u);
        const label = escapeHtmlAttr(u);
        return `<li class="row"><a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;
      })
      .join('\n');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Exported URLs — ${escapeHtmlAttr(dateStr)}</title>
  <style>
    body { font-family: system-ui, Segoe UI, Roboto, sans-serif; margin: 2rem; color: #111827; background: #f9fafb; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p.meta { font-size: 0.875rem; color: #6b7280; margin-bottom: 1.25rem; }
    ol { margin: 0; padding-left: 1.25rem; }
    li.row { margin: 0.5rem 0; word-break: break-all; }
    a { color: #2563eb; text-decoration: underline; }
    a:hover { color: #1d4ed8; }
  </style>
</head>
<body>
  <h1>Exported job links</h1>
  <p class="meta">${urls.length} URL${urls.length !== 1 ? 's' : ''} · ${escapeHtmlAttr(dateStr)}</p>
  <ol>
${items}
  </ol>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `workspace-urls-${dateStr}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  }, [selectedLinkIds, savedLinks]);

  const allPageLinksSelected =
    paginatedLinkRows.length > 0 && paginatedLinkRows.every((r) => selectedLinkSet.has(String(r.key)));
  const somePageLinksSelected =
    paginatedLinkRows.some((r) => selectedLinkSet.has(String(r.key))) && !allPageLinksSelected;

  useEffect(() => {
    const el = linkSelectAllRef.current;
    if (el) el.indeterminate = somePageLinksSelected;
  }, [somePageLinksSelected]);

  useEffect(() => {
    function onDocPointerDown(e) {
      // Close header filter popovers when clicking anywhere outside the filter button/popup itself.
      // (Clicking other header cells should close it too.)
      const inside = e?.target && typeof e.target.closest === 'function'
        ? e.target.closest('[data-link-header-filter-root="true"]')
        : null;
      if (inside) return;
      setOpenLinkHeaderFilter('');
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  const toggleLinkSelected = useCallback((id) => {
    const sid = String(id);
    setSelectedLinkIds((prev) => (prev.some((x) => String(x) === sid) ? prev.filter((x) => String(x) !== sid) : [...prev, sid]));
  }, []);

  const toggleSelectAllLinksOnPage = useCallback(() => {
    const pageIds = paginatedLinkRows.map((r) => String(r.key));
    if (pageIds.length === 0) return;
    if (allPageLinksSelected) {
      const pageSet = new Set(pageIds);
      setSelectedLinkIds((prev) => prev.filter((id) => !pageSet.has(String(id))));
      return;
    }
    setSelectedLinkIds((prev) => {
      const next = new Set(prev.map(String));
      pageIds.forEach((id) => next.add(id));
      return [...next];
    });
  }, [paginatedLinkRows, allPageLinksSelected]);

  const removeLinksByIds = useCallback(async (ids) => {
    const unique = [...new Set(ids.map(String))].filter(Boolean);
    if (unique.length === 0) return;
    setDeletingLinks(true);
    setLinksError('');
    try {
      await deleteWorkspaceLinks(unique);
      const fresh = await listWorkspaceLinks();
      setSavedLinks(Array.isArray(fresh) ? fresh : []);
      setSelectedLinkIds((prev) => prev.filter((id) => !unique.includes(String(id))));
    } catch (err) {
      setLinksError(err.response?.data?.error || err.message || 'Failed to delete links');
    } finally {
      setDeletingLinks(false);
    }
  }, []);

  const createManualLink = useCallback(async () => {
    const url = manualUrl.trim();
    if (!url) {
      setLinksError('Paste a URL first.');
      return;
    }
    setCreatingManualLink(true);
    setLinksError('');
    try {
      await saveWorkspaceLinks({ sourceFileName: 'manual', urls: [url] });
      setManualUrl('');
      const fresh = await listWorkspaceLinks();
      setSavedLinks(Array.isArray(fresh) ? fresh : []);
    } catch (err) {
      setLinksError(err.response?.data?.error || err.message || 'Failed to save link');
    } finally {
      setCreatingManualLink(false);
    }
  }, [manualUrl]);

  const setProfileForLinkIds = useCallback(async ({ ids, profileId }) => {
    const unique = [...new Set((ids || []).map(String))].filter(Boolean);
    if (unique.length === 0) return;
    setLinksError('');
    setUpdatingProfileLinkIds((prev) => [...new Set([...prev, ...unique])]);
    try {
      await setProfileForWorkspaceLinks({ ids: unique, profileId: profileId ?? '' });
      const fresh = await listWorkspaceLinks();
      setSavedLinks(Array.isArray(fresh) ? fresh : []);
    } catch (err) {
      setLinksError(err.response?.data?.error || err.message || 'Failed to set profile');
    } finally {
      setUpdatingProfileLinkIds((prev) => prev.filter((id) => !unique.includes(String(id))));
    }
  }, []);

  const generateCvsByLinkIds = useCallback(async (ids) => {
    const unique = [...new Set((ids || []).map(String))].filter(Boolean);
    if (unique.length === 0) return;

    const linkById = Object.fromEntries((Array.isArray(savedLinks) ? savedLinks : []).map((l) => [String(l._id), l]));
    const validProfileIds = new Set(profiles.map((p) => String(p._id)));

    const linksWithoutProfile = unique.filter((id) => {
      const pid = profileRefToIdString(linkById[id]?.profileId);
      return !pid || !validProfileIds.has(pid);
    });

    if (linksWithoutProfile.length > 0) {
      const msg = profiles.length === 0
        ? 'Create a profile on the Profile page, then assign it to each selected link before generating.'
        : `${linksWithoutProfile.length} selected link(s) have no profile or a removed profile. Choose a profile in the Profile column for each row.`;
      setLinksError(msg);
      window.alert(msg);
      return;
    }

    const jobDescriptionsByLinkId = Object.fromEntries(
      unique.map((id) => [id, String(jdByLinkId[id] || '').trim()])
    );
    const missing = unique.filter((id) => !jobDescriptionsByLinkId[id] || jobDescriptionsByLinkId[id].length < 40);
    if (missing.length > 0) {
      setLinksError(`Add a JD (min ~40 chars) for ${missing.length} selected link(s) first. Click "JD" on each link to paste it.`);
      return;
    }

    setGeneratingLinks(true);
    setLinksError('');
    setLastBulkGenResult(null);
    try {
      const resp = await generateCvsForWorkspaceLinks({
        ids: unique,
        profileId: '',
        jobDescriptionsByLinkId,
      });
      if (resp?.links) setSavedLinks(Array.isArray(resp.links) ? resp.links : []);
      const freshCvs = await listCVs();
      setCvList(Array.isArray(freshCvs) ? freshCvs : []);
      const createdCount = resp?.createdCount ?? 0;
      const failedCount = resp?.failedCount ?? 0;
      const failures = Array.isArray(resp?.failed) ? resp.failed : [];
      if (createdCount > 0 || failedCount > 0) {
        setLastBulkGenResult({ createdCount, failedCount, failures });
      }
    } catch (err) {
      setLastBulkGenResult(null);
      setLinksError(err.response?.data?.error || err.message || 'Failed to generate CVs');
    } finally {
      setGeneratingLinks(false);
    }
  }, [jdByLinkId, savedLinks, profiles]);

  const toggleJdForRow = useCallback((row) => {
    const id = String(row?.key || '');
    if (!id) return;
    setJdOpenLinkId((cur) => (cur === id ? '' : id));
  }, []);

  const queueSaveJd = useCallback(({ id, jobDescription }) => {
    const sid = String(id || '');
    if (!sid) return;

    // Clear previous debounce timer for this link.
    const prevTimer = jdSaveTimersRef.current[sid];
    if (prevTimer) {
      clearTimeout(prevTimer);
      delete jdSaveTimersRef.current[sid];
    }

    jdSaveTimersRef.current[sid] = setTimeout(async () => {
      setSavingJdLinkIds((prev) => [...new Set([...prev, sid])]);
      setJdSaveErrorByLinkId((prev) => ({ ...prev, [sid]: '' }));
      try {
        const updated = await setJobDescriptionForWorkspaceLink({ id: sid, jobDescription });
        // Keep table data in sync so reloads / other UI reads the DB value.
        setSavedLinks((prev) =>
          (Array.isArray(prev) ? prev : []).map((l) => (String(l?._id || '') === sid ? updated : l))
        );
      } catch (err) {
        const msg = err?.response?.data?.error || err?.message || 'Failed to save JD';
        setJdSaveErrorByLinkId((prev) => ({ ...prev, [sid]: String(msg) }));
      } finally {
        setSavingJdLinkIds((prev) => prev.filter((x) => String(x) !== sid));
      }
    }, 650);
  }, []);

  const paginatedCvs = useMemo(() => {
    const start = (cvPage - 1) * cvPageSize;
    return sortedFilteredCvs.slice(start, start + cvPageSize);
  }, [sortedFilteredCvs, cvPage, cvPageSize]);

  if (!user?.isApproved && user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-xl font-bold text-primary mb-2">Pending Approval</h2>
        <p className="text-gray-500 max-w-sm">An admin needs to approve your account first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-primary">Workspace</h2>
        <button
          type="button"
          onClick={downloadExtensionZip}
          disabled={downloadingExtension}
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
          title="Download the Chrome extension folder as a ZIP"
        >
          {downloadingExtension ? 'Downloading…' : 'Download Chrome Extension'}
        </button>
      </div>

      {/* Upload files + manual link (stacked) */}
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="space-y-8">
              <div className="space-y-3 min-w-0">
                <label className="block text-sm font-semibold text-gray-700">Upload files</label>
                <p className="text-xs text-gray-400">
                  Drag and drop or browse. PDF, Word, HTML, and plain text.{' '}
                  <strong className="text-gray-600">http(s)://</strong> links are extracted and <strong className="text-gray-600">saved to your account</strong>. File names are kept for this session only.
                </p>
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                  onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setDragActive(false); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl px-4 py-10 text-center cursor-pointer transition ${
                    dragActive ? 'border-accent bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                  }`}
                >
                  <p className="text-2xl mb-2" aria-hidden>📎</p>
                  <p className="text-sm font-medium text-gray-700">Drop files here</p>
                  <p className="text-xs text-gray-400 mt-1">or click to choose</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT_UPLOAD}
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              <div className="space-y-3 min-w-0 border-t border-gray-100 pt-8">
                <label className="block text-sm font-semibold text-gray-700">Add link manually</label>
                <p className="text-xs text-gray-400">
                  Paste a job posting URL and save it to your saved hyperlinks (same rules as extracted links).
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') createManualLink(); }}
                    placeholder="https://…"
                    className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={createManualLink}
                    disabled={creatingManualLink || deletingLinks || generatingLinks}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-emerald-700 disabled:opacity-50 sm:w-28"
                    title="Add this link to your account"
                  >
                    {creatingManualLink ? 'Saving…' : 'Add'}
                  </button>
                </div>
              </div>
        </div>
      </div>

      {/* Tables: extracted links + CVs */}
      <div className="bg-white rounded-2xl shadow p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2" role="tablist" aria-label="Workspace tables">
            <button
              type="button"
              role="tab"
              aria-selected={workspaceTableTab === 'links'}
              onClick={() => setWorkspaceTableTab('links')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                workspaceTableTab === 'links'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Jobs
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspaceTableTab === 'cvs'}
              onClick={() => setWorkspaceTableTab('cvs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                workspaceTableTab === 'cvs'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Resumes
            </button>
          </div>
        </div>

        {/* Hyperlinks from uploads */}
        {workspaceTableTab === 'links' && (
        <div className="space-y-4" role="tabpanel">
          <div className="space-y-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-primary">Jobs</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                New URLs are saved once per account (normalized). If the same URL is uploaded again, that row is marked <strong className="text-gray-600">Duplicate</strong>, <strong className="text-gray-600">Updated</strong> shows the last re-upload time, and <strong className="text-gray-600">Created</strong> stays the first time you saved it. Changing profile, JD, or CV status does not change duplicate status or these times.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-500 mb-0.5">Filter links</label>
                <input
                  type="search"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  placeholder="URL or file name…"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-500 mb-0.5">From</label>
                <input
                  type="date"
                  value={linkDateFrom}
                  onChange={(e) => setLinkDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-500 mb-0.5">To</label>
                <input
                  type="date"
                  value={linkDateTo}
                  onChange={(e) => setLinkDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-500 mb-0.5">Rows per page</label>
                <select
                  value={linkPageSize}
                  onChange={(e) => setLinkPageSize(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {linksError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{linksError}</div>
          )}

          {lastBulkGenResult && (lastBulkGenResult.createdCount > 0 || lastBulkGenResult.failedCount > 0) && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/90 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-gray-800">Generate CV finished</p>
                <button
                  type="button"
                  onClick={() => setLastBulkGenResult(null)}
                  className="text-xs text-gray-500 hover:text-gray-800 underline shrink-0"
                >
                  Dismiss
                </button>
              </div>
              {lastBulkGenResult.createdCount > 0 && (
                <p className="text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1.5 text-xs">
                  Created {lastBulkGenResult.createdCount} CV{lastBulkGenResult.createdCount !== 1 ? 's' : ''}.
                </p>
              )}
              {lastBulkGenResult.failedCount > 0 && (
                <div className="text-amber-950 bg-amber-50 border border-amber-200 rounded-md px-2 py-2 text-xs space-y-1.5">
                  <p className="font-semibold">
                    {lastBulkGenResult.failedCount} link{lastBulkGenResult.failedCount !== 1 ? 's' : ''} failed (others were processed)
                  </p>
                  <ul className="list-disc pl-4 space-y-1 max-h-48 overflow-y-auto">
                    {(lastBulkGenResult.failures || []).map((f) => (
                      <li key={String(f.linkId)} className="break-words">
                        <span className="text-gray-600 font-mono text-[11px]">
                          {(f.url || '').length > 72 ? `${(f.url || '').slice(0, 72)}…` : (f.url || f.linkId || '—')}
                        </span>
                        {': '}
                        <span className="text-red-800">{f.error || 'Unknown error'}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-900/90 pt-1">
                    Each failed link still stores the latest reason in the database — hover the <strong className="font-medium">Failed</strong> badge in the CV status column to read it.
                  </p>
                </div>
              )}
            </div>
          )}

          {loadingSavedLinks ? (
            <p className="text-sm text-gray-400 text-center py-10">Loading saved links…</p>
          ) : savedLinks.length === 0 && uploadedFiles.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
              Upload a file above to extract <code className="text-xs bg-gray-100 px-1 rounded">http(s)://</code> links; they will be stored in the database and appear here.
            </p>
          ) : savedLinks.length === 0 && linkTableRows.length === 0 && !anyLinkExtracting ? (
            <p className="text-sm text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
              {savedLinks.length > 0
                ? 'No links match your filter.'
                : uploadedFiles.length > 0
                  ? 'No hyperlinks were found in your uploaded files.'
                  : 'No saved links yet.'}
            </p>
          ) : (
            <>
              {anyLinkExtracting && (
                <p className="text-xs text-gray-500">Still scanning one or more files…</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {selectedLinkIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-amber-900 tabular-nums">
                      {selectedLinkIds.length} selected
                    </span>
                    <button
                      type="button"
                      disabled={deletingLinks || generatingLinks}
                      onClick={() => generateCvsByLinkIds(selectedLinkIds)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                      title="Generate CVs for selected links"
                    >
                      {generatingLinks ? 'Generating…' : 'Generate CV'}
                    </button>
                    <button
                      type="button"
                      disabled={deletingLinks || generatingLinks}
                      onClick={exportSelectedLinkUrls}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                      title="Download selected URLs as an HTML file (clickable list)"
                    >
                      Export selected URLs
                    </button>
                    <button
                      type="button"
                      disabled={deletingLinks}
                      onClick={() => {
                        removeLinksByIds(selectedLinkIds);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
                    >
                      <TrashIcon />
                      Delete selected
                    </button>
                  </div>
                )}
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="max-h-[520px] overflow-y-auto overflow-x-hidden">
                  <table className="w-full text-sm table-fixed min-w-0">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 z-10">
                          <th className="px-1.5 py-3 w-11 text-center">
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-md focus-within:outline-none focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-1">
                              <input
                                ref={linkSelectAllRef}
                                type="checkbox"
                                className="sr-only"
                                checked={allPageLinksSelected}
                                onChange={toggleSelectAllLinksOnPage}
                                disabled={deletingLinks || paginatedLinkRows.length === 0}
                                aria-label="Select all links on this page"
                              />
                              <LinkSelectIcon checked={allPageLinksSelected} indeterminate={somePageLinksSelected} />
                            </label>
                          </th>
                          <th scope="col" className="px-4 py-3 w-[22%]">
                            <div className="flex items-center gap-2">
                              <span>Source file</span>
                              <div className="relative" data-link-header-filter-root="true">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setOpenLinkHeaderFilter((cur) => (cur === 'source' ? '' : 'source')); }}
                                  className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                  aria-label="Filter by source file"
                                >
                                  <FunnelIcon />
                                </button>
                                {openLinkHeaderFilter === 'source' && (
                                  <div
                                    className="absolute left-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-2 z-20"
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <select
                                      value={linkSourceFileFilter}
                                      onChange={(e) => setLinkSourceFileFilter(e.target.value)}
                                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                                    >
                                      <option value="all">All</option>
                                      {Array.from(
                                        new Set((Array.isArray(savedLinks) ? savedLinks : []).map((l) => String(l?.sourceFileName || '')).filter(Boolean))
                                      )
                                        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                                        .map((name) => (
                                          <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          </th>
                          <th scope="col" className="px-4 py-3 w-[12%]">
                            <div className="flex items-center gap-2">
                              <span>Profile</span>
                              <div className="relative" data-link-header-filter-root="true">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setOpenLinkHeaderFilter((cur) => (cur === 'profile' ? '' : 'profile')); }}
                                  className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                  aria-label="Filter by profile"
                                >
                                  <FunnelIcon />
                                </button>
                                {openLinkHeaderFilter === 'profile' && (
                                  <div
                                    className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg p-2 z-20"
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <select
                                      value={linkProfileFilter}
                                      onChange={(e) => setLinkProfileFilter(e.target.value)}
                                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                                    >
                                      <option value="all">All profiles</option>
                                      <option value="none">No profile</option>
                                      {profiles.map((p) => (
                                        <option key={p._id} value={String(p._id)}>{p.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          </th>
                          <th scope="col" className="px-4 py-3 w-[40%]">URL</th>
                          <th scope="col" className="px-4 py-3 w-[10%]">
                            <div className="flex items-center gap-2">
                              <span>Type</span>
                              <div className="relative" data-link-header-filter-root="true">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setOpenLinkHeaderFilter((cur) => (cur === 'type' ? '' : 'type')); }}
                                  className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                  aria-label="Filter by type"
                                >
                                  <FunnelIcon />
                                </button>
                                {openLinkHeaderFilter === 'type' && (
                                  <div
                                    className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg p-2 z-20"
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <select
                                      value={linkTypeFilter}
                                      onChange={(e) => setLinkTypeFilter(e.target.value)}
                                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                                    >
                                      <option value="all">All types</option>
                                      <option value="linkedin">LinkedIn</option>
                                      <option value="other">Other</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          </th>
                          <th scope="col" className="px-4 py-3 w-[11%] whitespace-nowrap">Created</th>
                          <th scope="col" className="px-4 py-3 w-[11%] whitespace-nowrap">Updated</th>
                          <th scope="col" className="px-4 py-3 w-[13%]">
                            <div className="flex items-center gap-2">
                              <span>CV status</span>
                              <div className="relative" data-link-header-filter-root="true">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setOpenLinkHeaderFilter((cur) => (cur === 'cvStatus' ? '' : 'cvStatus')); }}
                                  className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                  aria-label="Filter by CV status"
                                >
                                  <FunnelIcon />
                                </button>
                                {openLinkHeaderFilter === 'cvStatus' && (
                                  <div
                                    className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg p-2 z-20"
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <select
                                      value={linkCvStatusFilter}
                                      onChange={(e) => setLinkCvStatusFilter(e.target.value)}
                                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                                    >
                                      <option value="all">All</option>
                                      <option value="not_started">Empty</option>
                                      <option value="pending">Creating…</option>
                                      <option value="created">Created</option>
                                      <option value="failed">Failed</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          </th>
                          <th className="px-4 py-3 pl-4 pr-1 w-[9%]">
                            <div className="flex items-center gap-2">
                              <span>JD</span>
                              <div className="relative" data-link-header-filter-root="true">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setOpenLinkHeaderFilter((cur) => (cur === 'jd' ? '' : 'jd')); }}
                                  className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                  aria-label="Filter by job description"
                                >
                                  <FunnelIcon />
                                </button>
                                {openLinkHeaderFilter === 'jd' && (
                                  <div
                                    className="absolute right-0 mt-2 w-36 rounded-lg border border-gray-200 bg-white shadow-lg p-2 z-20"
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <select
                                      value={linkJdFilter}
                                      onChange={(e) => setLinkJdFilter(e.target.value)}
                                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                                    >
                                      <option value="all">All</option>
                                      <option value="has">Has JD</option>
                                      <option value="missing">Missing JD</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          </th>
                          <th className="pl-0 pr-2 py-3 w-10" aria-label="Delete link" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedLinkRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-6 py-10 text-center text-sm text-gray-400">
                            {savedLinks.length > 0 ? 'No jobs match your current filters.' : 'No jobs yet.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedLinkRows.flatMap((row) => {
                          const id = String(row.key);
                          const isOpen = jdOpenLinkId === id;
                          const jd = jdByLinkId[id] || '';
                          const hasJd = String(jd || '').trim().length > 0;

                          return [
                            (
                              <tr key={row.key} className="hover:bg-gray-50">
                                <td className="px-1.5 py-2 w-11 text-center align-middle">
                                  <label className="inline-flex cursor-pointer items-center justify-center rounded-md focus-within:outline-none focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-1">
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={selectedLinkSet.has(String(row.key))}
                                      onChange={() => toggleLinkSelected(row.key)}
                                      disabled={deletingLinks}
                                      aria-label={`Select link ${(row.url || '').slice(0, 48)}${(row.url || '').length > 48 ? '…' : ''}`}
                                    />
                                    <LinkSelectIcon checked={selectedLinkSet.has(String(row.key))} />
                                  </label>
                                </td>
                                <td className="px-4 py-3 text-gray-700 font-medium min-w-0" title={row.fileName}>
                                  <div className="truncate">
                                    {row.fileName}
                                  </div>
                                </td>
                                <td className="px-4 py-3 min-w-0">
                                  {(() => {
                                    const pid = profileRefToIdString(row.profileId);
                                    const hasProfile = Boolean(pid);
                                    const cls = hasProfile
                                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900 focus:ring-emerald-300'
                                      : 'border-red-200 bg-red-50/60 text-red-800 focus:ring-red-300';
                                    return (
                                  <select
                                    value={pid}
                                    onChange={(e) => setProfileForLinkIds({ ids: [row.key], profileId: e.target.value })}
                                    disabled={deletingLinks || generatingLinks || updatingProfileLinkIds.includes(String(row.key))}
                                    className={`w-full max-w-[170px] cursor-pointer appearance-none border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 [&::-ms-expand]:hidden ${cls}`}
                                    title={hasProfile ? 'Profile selected' : 'No profile selected'}
                                  >
                                    <option value="">No profile</option>
                                    {profiles.map((p) => (
                                      <option key={p._id} value={String(p._id)}>{p.label}</option>
                                    ))}
                                  </select>
                                    );
                                  })()}
                                </td>
                                <td className="px-4 py-3 min-w-0" title={row.url}>
                                  <a
                                    href={row.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-accent hover:underline truncate text-xs"
                                  >
                                    {row.url}
                                  </a>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                                      row.linkType === 'linkedin'
                                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                                        : 'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}
                                    title={row.linkType === 'linkedin' ? 'LinkedIn URL' : 'Non-LinkedIn URL'}
                                  >
                                    {row.linkType === 'linkedin' ? 'LinkedIn' : 'Other'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                  {formatLinkDate(row.createdAt)}
                                </td>
                                <td
                                  className={`px-4 py-3 text-xs whitespace-nowrap ${
                                    row.isDuplicate ? 'text-amber-900 font-medium' : 'text-gray-500'
                                  }`}
                                  title={
                                    row.isDuplicate
                                      ? 'Last time this URL was uploaded again (same normalized link)'
                                      : 'Shown only for duplicate rows (same URL saved more than once)'
                                  }
                                >
                                  {formatUpdatedCell(row)}
                                </td>
                                <td className="px-4 py-3 min-w-0 align-middle">
                                  <CvCreateBadge
                                    status={row.cvStatus}
                                    errorTitle={row.cvStatus === 'failed' ? failedCvHoverText(row) : undefined}
                                  />
                                </td>
                                <td className="px-4 py-3 pl-4 pr-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleJdForRow(row)}
                                    disabled={deletingLinks}
                                    className={`inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition disabled:opacity-50 ${
                                      hasJd
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                        : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                    }`}
                                    title={hasJd ? 'Job description saved' : 'Missing job description'}
                                  >
                                    {isOpen ? 'Hide' : 'JD'}
                                  </button>
                                </td>
                                <td className="py-3 pl-0 pr-2">
                                  <button
                                    type="button"
                                    disabled={deletingLinks || generatingLinks}
                                    onClick={() => {
                                      removeLinksByIds([row.key]);
                                    }}
                                    className="inline-flex items-center justify-center rounded-md p-1 text-red-600 hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
                                    title="Delete this link"
                                    aria-label="Delete this link"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ),
                            isOpen ? (
                              <tr key={`${row.key}-preview`} className="bg-white">
                                <td className="px-4 py-3" colSpan={10}>
                                  <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                                    <div className="space-y-2">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Job description</p>
                                          <p className="text-xs text-gray-500 truncate" title={row.url}>
                                            {row.url}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setJdByLinkId((prev) => ({ ...prev, [id]: '' }));
                                            queueSaveJd({ id, jobDescription: '' });
                                          }}
                                          className="shrink-0 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg px-2 py-1 hover:bg-white/70 border border-transparent hover:border-gray-200"
                                          title="Clear JD"
                                        >
                                          Clear
                                        </button>
                                      </div>
                                      <textarea
                                        value={jd}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setJdByLinkId((prev) => ({ ...prev, [id]: v }));
                                          queueSaveJd({ id, jobDescription: v });
                                        }}
                                        placeholder="Paste or type the job description here…"
                                        className="w-full min-h-[140px] border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                                      />
                                      <p className="text-xs text-gray-500">
                                        {savingJdLinkIds.includes(String(id))
                                          ? 'Saving…'
                                          : jdSaveErrorByLinkId[String(id)]
                                            ? `Save failed: ${jdSaveErrorByLinkId[String(id)]}`
                                            : 'Saved to your account.'}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null,
                          ].filter(Boolean);
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 pb-3 bg-gray-50/80 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-gray-500">
                    {linkTableRows.length > 0 ? (
                      <>
                        Showing{' '}
                        <strong className="text-primary">
                          {(linkPage - 1) * linkPageSize + 1}
                          –
                          {Math.min(linkPage * linkPageSize, linkTableRows.length)}
                        </strong>
                        {' '}of <strong className="text-primary">{linkTableRows.length}</strong> link{linkTableRows.length !== 1 ? 's' : ''}
                        {(linkSearch.trim() || linkDateFrom || linkDateTo || linkCvStatusFilter !== 'all' || linkProfileFilter !== 'all' || linkTypeFilter !== 'all' || linkJdFilter !== 'all' || linkSourceFileFilter !== 'all') ? ' (filtered)' : ''}
                        {' '}· {linkPageSize} / page
                      </>
                    ) : null}
                  </p>
                  <Pagination
                    page={linkPage}
                    total={linkTableRows.length}
                    pageSize={linkPageSize}
                    onChange={setLinkPage}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        )}

        {workspaceTableTab === 'cvs' && (
        <div className="space-y-4" role="tabpanel">
          <div className="space-y-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-primary">Resumes</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Search and filter. Click a row or Open to view the CV in a new tab.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full">
              <div className="w-full sm:flex-1 sm:min-w-[160px]">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Role, company, job type, work mode…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                >
                  <option value="all">All statuses</option>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Profile</label>
                <select
                  value={tableProfileFilter}
                  onChange={(e) => setTableProfileFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                >
                  <option value="all">All profiles</option>
                  {profiles.map((p) => (
                    <option key={p._id} value={String(p._id)}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={cvDateFrom}
                  onChange={(e) => setCvDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                />
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={cvDateTo}
                  onChange={(e) => setCvDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                />
              </div>
              <div className="w-full sm:w-36">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Rows per page</label>
                <select
                  value={cvPageSize}
                  onChange={(e) => setCvPageSize(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loadingCvs ? (
            <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>
          ) : cvList.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              <p>No CVs yet.</p>
              <Link to="/create" className="text-accent hover:underline mt-2 inline-block">Create your first CV →</Link>
            </div>
          ) : sortedFilteredCvs.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                <strong className="text-primary">0</strong> of {cvList.length} CV{cvList.length !== 1 ? 's' : ''} match filters
                {(search.trim() || statusFilter !== 'all' || tableProfileFilter !== 'all' || cvDateFrom || cvDateTo) ? ' (filtered)' : ''}
                {statusFilter !== 'all' && (
                  <span> · status = {STATUS_CONFIG[statusFilter]?.label}</span>
                )}
              </p>
              <p className="text-sm text-gray-400 text-center py-10 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                No CVs match your search or filters.
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 z-10">
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 whitespace-nowrap">Work mode</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Created</th>
                      <th className="px-3 py-3 w-10" aria-label="Delete CV" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedCvs.map((cv) => {
                      const st = cv.application_status || 'saved';
                      const profileLabel = profileRefToLabel(cv.profileId, profileLabelById) || '—';
                      return (
                        <tr
                          key={cv._id}
                          onClick={() => openCvInNewWindow(cv._id)}
                          className="hover:bg-gray-50 cursor-pointer transition"
                        >
                          <td className="px-4 py-3 font-medium text-primary">{cv.role_title || '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{cv.company_name || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{cv.job_type || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {cv.remote_status && cv.remote_status !== 'Unspecified' ? cv.remote_status : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{profileLabel}</td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <StatusBadge status={st} />
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {cv.createdAt
                              ? new Date(cv.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                              : '—'}
                          </td>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={!!deletingCvId}
                              onClick={() => deleteCvById(cv._id)}
                              className="inline-flex items-center justify-center rounded-md p-1 text-red-600 hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
                              title="Delete this CV"
                              aria-label="Delete this CV"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-3 pb-3 bg-gray-50/80 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  {sortedFilteredCvs.length > 0 ? (
                    <>
                      Showing{' '}
                      <strong className="text-primary">
                        {(cvPage - 1) * cvPageSize + 1}
                        –
                        {Math.min(cvPage * cvPageSize, sortedFilteredCvs.length)}
                      </strong>
                      {' '}of <strong className="text-primary">{sortedFilteredCvs.length}</strong> CV{sortedFilteredCvs.length !== 1 ? 's' : ''}
                      {(search.trim() || statusFilter !== 'all' || tableProfileFilter !== 'all') ? ' (filtered)' : ''}
                      {' '}· {cvList.length} total · {cvPageSize} / page
                      {statusFilter !== 'all' && (
                        <span> · status = {STATUS_CONFIG[statusFilter]?.label}</span>
                      )}
                    </>
                  ) : null}
                </p>
                <Pagination
                  page={cvPage}
                  total={sortedFilteredCvs.length}
                  pageSize={cvPageSize}
                  onChange={setCvPage}
                />
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
