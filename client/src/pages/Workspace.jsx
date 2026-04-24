import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listProfiles, listCVs, listWorkspaceLinks, saveWorkspaceLinks, deleteWorkspaceLinks } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Pagination from '../components/Pagination.jsx';

const STATUS_CONFIG = {
  saved:     { label: 'Saved',     badge: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  applied:   { label: 'Applied',   badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  interview: { label: 'Interview', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  offer:     { label: 'Offer',     badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  rejected:  { label: 'Rejected',  badge: 'bg-red-100 text-red-500',      dot: 'bg-red-400' },
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
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 transition ${boxClass}`} aria-hidden>
      {indeterminate ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 12h12" />
        </svg>
      ) : checked ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg className="w-4 h-4 opacity-35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}

function TrashIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  );
}

function DuplicateBadge({ isDuplicate }) {
  if (isDuplicate) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        Duplicate
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
      Unique
    </span>
  );
}

function CvCreateBadge({ status }) {
  const s = String(status || 'not_started');
  const cfg = {
    not_started: { label: 'Not started', cls: 'bg-gray-100 text-gray-600' },
    pending: { label: 'Creating…', cls: 'bg-blue-100 text-blue-700' },
    created: { label: 'Created', cls: 'bg-emerald-100 text-emerald-800' },
    failed: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
  }[s] || { label: 'Not started', cls: 'bg-gray-100 text-gray-600' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
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
  const c = row.createdAt ? new Date(row.createdAt).getTime() : 0;
  const u = row.updatedAt ? new Date(row.updatedAt).getTime() : c;
  if (row.isDuplicate) {
    return formatLinkDate(row.updatedAt || row.createdAt);
  }
  if (u !== c) return formatLinkDate(row.updatedAt);
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
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const selectedProfileIdRef = useRef('');

  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);

  const [savedLinks, setSavedLinks] = useState([]);
  const [loadingSavedLinks, setLoadingSavedLinks] = useState(true);
  const [linksError, setLinksError] = useState('');

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  const [cvList, setCvList] = useState([]);
  const [loadingCvs, setLoadingCvs] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableProfileFilter, setTableProfileFilter] = useState('all');
  const [linkSearch, setLinkSearch] = useState('');
  const [linkProfileFilter, setLinkProfileFilter] = useState('all');
  const [linkStatusFilter, setLinkStatusFilter] = useState('all'); // all | unique | duplicate
  const [linkPage, setLinkPage] = useState(1);
  const [cvPage, setCvPage] = useState(1);
  const [linkPageSize, setLinkPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [cvPageSize, setCvPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [linkSortField, setLinkSortField] = useState('updated');
  const [linkSortOrder, setLinkSortOrder] = useState('desc');
  const [cvSortField, setCvSortField] = useState('updated');
  const [cvSortOrder, setCvSortOrder] = useState('desc');

  const [selectedLinkIds, setSelectedLinkIds] = useState([]);
  const [deletingLinks, setDeletingLinks] = useState(false);
  const linkSelectAllRef = useRef(null);

  useEffect(() => {
    listProfiles()
      .then((data) => {
        setProfiles(data);
        if (data.length > 0) {
          setSelectedProfileId(data[0]._id);
          setSelectedProfile(data[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    selectedProfileIdRef.current = selectedProfileId;
  }, [selectedProfileId]);

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

  useEffect(() => {
    if (!user?.isApproved && user?.role !== 'admin') return;
    listCVs()
      .then(setCvList)
      .catch(() => setCvList([]))
      .finally(() => setLoadingCvs(false));
  }, [user]);

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

  const filteredCvs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cvList.filter((cv) => {
      const pid = String(cv.profileId ?? '');
      if (tableProfileFilter !== 'all' && pid !== tableProfileFilter) return false;
      const st = cv.application_status || 'saved';
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (q) {
        const hay = [cv.role_title, cv.company_name, cv.job_type, cv.salary_range]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cvList, search, statusFilter, tableProfileFilter]);

  const profileLabelById = useMemo(
    () => Object.fromEntries(profiles.map((p) => [String(p._id), p.label])),
    [profiles]
  );

  const linkTableRows = useMemo(() => {
    const list = Array.isArray(savedLinks) ? savedLinks : [];
    const q = linkSearch.trim().toLowerCase();
    const rows = list
      .filter((row) => {
        const pid = row.profileId != null ? String(row.profileId) : '';
        if (linkProfileFilter !== 'all' && pid !== String(linkProfileFilter)) return false;

        if (!q) return true;
        const url = (row.url || '').toLowerCase();
        const fname = (row.sourceFileName || '').toLowerCase();
        const pl = String(
          (row.profileId && profileLabelById[String(row.profileId)]) || ''
        ).toLowerCase();
        return url.includes(q) || fname.includes(q) || pl.includes(q);
      })
      .map((row) => ({
        key: row._id,
        fileName: row.sourceFileName,
        url: row.url,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        // Display status is derived from timestamps:
        // - Unique: updatedAt equals createdAt (shows "—" in Updated column)
        // - Duplicate: updatedAt differs from createdAt (link re-upload / merge)
        isDuplicate: (() => {
          const c = row.createdAt ? new Date(row.createdAt).getTime() : 0;
          const u = row.updatedAt ? new Date(row.updatedAt).getTime() : c;
          return Boolean(c && u && u !== c);
        })(),
        profileId: row.profileId,
        cvStatus: row.cvStatus || 'not_started',
      }));

    const status = String(linkStatusFilter || 'all');
    const filteredByStatus =
      status === 'all'
        ? rows
        : status === 'duplicate'
          ? rows.filter((r) => r.isDuplicate)
          : rows.filter((r) => !r.isDuplicate);

    const mul = linkSortOrder === 'desc' ? -1 : 1;
    filteredByStatus.sort((a, b) => {
      let cmp = 0;
      if (linkSortField === 'profile') {
        const la = String(profileLabelById[String(a.profileId)] || '').toLowerCase();
        const lb = String(profileLabelById[String(b.profileId)] || '').toLowerCase();
        cmp = la.localeCompare(lb, undefined, { sensitivity: 'base' });
      } else if (linkSortField === 'created') {
        cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      } else {
        cmp = new Date(a.updatedAt || a.createdAt || 0).getTime() - new Date(b.updatedAt || b.createdAt || 0).getTime();
      }
      return cmp * mul;
    });
    return filteredByStatus;
  }, [savedLinks, linkSearch, linkProfileFilter, linkStatusFilter, profileLabelById, linkSortField, linkSortOrder]);

  const sortedFilteredCvs = useMemo(() => {
    const rows = [...filteredCvs];
    const mul = cvSortOrder === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      let cmp = 0;
      if (cvSortField === 'profile') {
        const la = String(profileLabelById[String(a.profileId ?? '')] || '').toLowerCase();
        const lb = String(profileLabelById[String(b.profileId ?? '')] || '').toLowerCase();
        cmp = la.localeCompare(lb, undefined, { sensitivity: 'base' });
      } else if (cvSortField === 'jobType') {
        const la = String(a.job_type || '').toLowerCase();
        const lb = String(b.job_type || '').toLowerCase();
        cmp = la.localeCompare(lb, undefined, { sensitivity: 'base' });
      } else if (cvSortField === 'created') {
        cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      } else {
        cmp = new Date(a.updatedAt || a.createdAt || 0).getTime() - new Date(b.updatedAt || b.createdAt || 0).getTime();
      }
      return cmp * mul;
    });
    return rows;
  }, [filteredCvs, profileLabelById, cvSortField, cvSortOrder]);

  const totalExtractedLinks = useMemo(() => savedLinks.length, [savedLinks]);

  const anyLinkExtracting = uploadedFiles.some((f) => f.extracting);

  useEffect(() => {
    const valid = new Set((Array.isArray(savedLinks) ? savedLinks : []).map((l) => String(l._id)));
    setSelectedLinkIds((prev) => prev.filter((id) => valid.has(String(id))));
  }, [savedLinks]);

  useEffect(() => {
    setLinkPage(1);
  }, [linkSearch, linkProfileFilter, linkStatusFilter, linkPageSize, linkSortField, linkSortOrder]);

  useEffect(() => {
    const tp = Math.ceil(linkTableRows.length / linkPageSize) || 1;
    setLinkPage((p) => Math.min(p, Math.max(1, tp)));
  }, [linkTableRows.length, linkPageSize]);

  useEffect(() => {
    setCvPage(1);
  }, [search, statusFilter, tableProfileFilter, cvPageSize, cvSortField, cvSortOrder]);

  useEffect(() => {
    const tp = Math.ceil(sortedFilteredCvs.length / cvPageSize) || 1;
    setCvPage((p) => Math.min(p, Math.max(1, tp)));
  }, [sortedFilteredCvs.length, cvPageSize]);

  const paginatedLinkRows = useMemo(() => {
    const start = (linkPage - 1) * linkPageSize;
    return linkTableRows.slice(start, start + linkPageSize);
  }, [linkTableRows, linkPage, linkPageSize]);

  const selectedLinkSet = useMemo(() => new Set(selectedLinkIds.map(String)), [selectedLinkIds]);

  const allPageLinksSelected =
    paginatedLinkRows.length > 0 && paginatedLinkRows.every((r) => selectedLinkSet.has(String(r.key)));
  const somePageLinksSelected =
    paginatedLinkRows.some((r) => selectedLinkSet.has(String(r.key))) && !allPageLinksSelected;

  useEffect(() => {
    const el = linkSelectAllRef.current;
    if (el) el.indeterminate = somePageLinksSelected;
  }, [somePageLinksSelected]);

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
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-primary">Workspace</h2>

      <div className="grid md:grid-cols-[2fr_3fr] gap-6">
        <div className="space-y-5">
          {/* File upload */}
          <div className="bg-white rounded-2xl shadow p-5 space-y-3">
            <label className="block text-sm font-semibold text-gray-700">Upload files</label>
            <p className="text-xs text-gray-400">
              Drag and drop or browse. PDF, Word, HTML, and plain text.{' '}
              <strong className="text-gray-600">http(s)://</strong> links are extracted and <strong className="text-gray-600">saved to your account</strong> with the active profile (if any). File names are kept for this session only.
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
            {uploadedFiles.length > 0 && (
              <ul className="divide-y border border-gray-100 rounded-lg overflow-hidden">
                {uploadedFiles.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-3 py-2.5 bg-white text-sm">
                    <span className="text-gray-400 shrink-0">📄</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-primary truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatBytes(item.size)}
                        {item.extracting ? (
                          <span className="text-accent ml-2">Scanning for links…</span>
                        ) : (
                          <span className="text-gray-500 ml-2">
                            {(item.urls?.length || 0)} link{(item.urls?.length || 0) !== 1 ? 's' : ''} found
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeUploaded(item.id); }}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0 px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Profiles — same pattern as Create CV */}
          <div className="bg-white rounded-2xl shadow p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Select profile</label>
            <p className="text-xs text-gray-400 mb-3">Default context for this workspace; the table below can still filter by any profile.</p>
            {profiles.length === 0 ? (
              <p className="text-yellow-600 text-sm">
                No profiles yet. <Link to="/profile" className="underline">Create one →</Link>
              </p>
            ) : (
              <div className="space-y-2">
                {profiles.map((p) => {
                  const active = selectedProfileId === p._id;
                  return (
                    <div
                      key={p._id}
                      onClick={() => { setSelectedProfileId(p._id); setSelectedProfile(p); }}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        active ? 'border-accent bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          active ? 'border-accent bg-accent' : 'border-gray-300'
                        }`}
                      >
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary">{p.label}</p>
                        <p className="text-xs text-gray-500">{p.name} · {p.email}</p>
                        <p className="text-xs text-gray-400">
                          {[
                            p.workExperiences?.length ? `${p.workExperiences.length} job(s)` : '',
                            p.education?.length ? `${p.education.length} education` : '',
                            p.certifications?.length ? `${p.certifications.length} cert(s)` : '',
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-2xl shadow p-6 sticky top-4 space-y-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Summary</p>
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <span className="font-semibold text-primary">{uploadedFiles.length}</span> file{uploadedFiles.length !== 1 ? 's' : ''} staged
              </p>
              <p>
                Links saved (database): <span className="font-semibold text-primary">{totalExtractedLinks}</span>
                {anyLinkExtracting && <span className="text-xs text-gray-400 ml-1">(scanning…)</span>}
              </p>
              <p>
                Active profile:{' '}
                <span className="font-semibold text-primary">{selectedProfile?.label || '—'}</span>
              </p>
              <p>
                Saved CVs: <span className="font-semibold text-primary">{cvList.length}</span>
              </p>
            </div>
            <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2">
              <Link
                to="/create"
                className="inline-flex items-center rounded-lg bg-violet-600 text-white text-sm font-medium px-4 py-2 hover:bg-violet-700 transition"
              >
                Create CV
              </Link>
              <Link
                to="/"
                className="inline-flex items-center rounded-lg border border-gray-200 text-sm font-medium px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tables: extracted links + CVs */}
      <div className="bg-white rounded-2xl shadow p-5 space-y-8">
        {/* Hyperlinks from uploads */}
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-primary">Saved hyperlinks</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                New URLs are saved once per account (normalized). If the same URL is uploaded again, the existing row is updated: <strong className="text-gray-600">Updated</strong> is set to now and <strong className="text-gray-600">Created</strong> becomes the previous <strong className="text-gray-600">Updated</strong> time.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full">
              <div className="w-full sm:w-56">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Filter links</label>
                <input
                  type="search"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  placeholder="URL or file name…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Profile</label>
                <select
                  value={linkProfileFilter}
                  onChange={(e) => setLinkProfileFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                >
                  <option value="all">All profiles</option>
                  <option value="">No profile</option>
                  {profiles.map((p) => (
                    <option key={p._id} value={String(p._id)}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
                <select
                  value={linkStatusFilter}
                  onChange={(e) => setLinkStatusFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                >
                  <option value="all">All</option>
                  <option value="unique">Unique</option>
                  <option value="duplicate">Duplicate</option>
                </select>
              </div>
              <div className="w-full sm:w-36">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Rows per page</label>
                <select
                  value={linkPageSize}
                  onChange={(e) => setLinkPageSize(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-36">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Sort by</label>
                <select
                  value={linkSortField}
                  onChange={(e) => setLinkSortField(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                >
                  <option value="profile">Profile</option>
                  <option value="created">Created</option>
                  <option value="updated">Updated</option>
                </select>
              </div>
              <div className="w-full sm:w-32">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Order</label>
                <select
                  value={linkSortOrder}
                  onChange={(e) => setLinkSortOrder(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
          </div>

          {linksError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{linksError}</div>
          )}

          {loadingSavedLinks ? (
            <p className="text-sm text-gray-400 text-center py-10">Loading saved links…</p>
          ) : savedLinks.length === 0 && uploadedFiles.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
              Upload a file above to extract <code className="text-xs bg-gray-100 px-1 rounded">http(s)://</code> links; they will be stored in the database and appear here.
            </p>
          ) : linkTableRows.length === 0 && !anyLinkExtracting ? (
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
                      disabled={deletingLinks}
                      onClick={() => {
                        if (!window.confirm(`Delete ${selectedLinkIds.length} link(s)? This cannot be undone.`)) return;
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
              {linkTableRows.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[980px] table-fixed">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          <th className="px-2 py-3 w-14 text-center">
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
                          <th className="px-4 py-3 w-[22%]">Source file</th>
                          <th className="px-4 py-3 w-[12%]">Profile</th>
                          <th className="px-4 py-3 w-[34%]">URL</th>
                          <th className="px-4 py-3 whitespace-nowrap w-[11%]">Created</th>
                          <th className="px-4 py-3 whitespace-nowrap w-[11%]">Updated</th>
                          <th className="px-4 py-3 w-[10%]">Status</th>
                          <th className="px-4 py-3 w-[12%]">CV status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedLinkRows.map((row) => (
                          <tr key={row.key} className="hover:bg-gray-50">
                            <td className="px-2 py-2 w-14 text-center align-middle">
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
                            <td className="px-4 py-3 text-gray-600 text-xs min-w-0" title={row.profileId ? profileLabelById[String(row.profileId)] : ''}>
                              <div className="truncate">
                                {row.profileId ? (profileLabelById[String(row.profileId)] || '—') : '—'}
                              </div>
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
                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                              {formatLinkDate(row.createdAt)}
                            </td>
                            <td
                              className={`px-4 py-3 text-xs whitespace-nowrap ${
                                row.isDuplicate ? 'text-amber-900 font-medium' : 'text-gray-500'
                              }`}
                              title={
                                row.isDuplicate
                                  ? 'Legacy duplicate row (saved before merge behavior)'
                                  : 'Last update time; Created shows the prior Updated time after a re-upload'
                              }
                            >
                              {formatUpdatedCell(row)}
                            </td>
                            <td className="px-4 py-3">
                              <DuplicateBadge isDuplicate={row.isDuplicate} />
                            </td>
                            <td className="px-4 py-3">
                              <CvCreateBadge status={row.cvStatus} />
                            </td>
                          </tr>
                        ))}
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
                          {(linkSearch.trim() || linkProfileFilter !== 'all' || linkStatusFilter !== 'all') ? ' (filtered)' : ''}
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
              )}
            </>
          )}
        </div>

        <div className="border-t border-gray-100 pt-8 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-sm font-bold text-primary">Saved CVs</h3>
            <p className="text-xs text-gray-400 mt-0.5">Search, filter, and sort. Click a row to open the CV.</p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Role, company, job type…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="min-w-[140px]">
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
            <div className="min-w-[160px]">
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
            <div className="min-w-[100px] w-full sm:w-36">
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
            <div className="w-full sm:w-36">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Sort by</label>
              <select
                value={cvSortField}
                onChange={(e) => setCvSortField(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
              >
                <option value="profile">Profile</option>
                <option value="jobType">Job type</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
              </select>
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Order</label>
              <select
                value={cvSortOrder}
                onChange={(e) => setCvSortOrder(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
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
        ) : (
          <>
            <p className="text-xs text-gray-500">
              {sortedFilteredCvs.length > 0 ? (
                <>
                  Rows <strong className="text-primary">{(cvPage - 1) * cvPageSize + 1}–{Math.min(cvPage * cvPageSize, sortedFilteredCvs.length)}</strong>
                  {' '}of <strong className="text-primary">{sortedFilteredCvs.length}</strong> matching
                  {' '}({cvList.length} CV{cvList.length !== 1 ? 's' : ''} total){' '}· {cvPageSize} per page
                  {statusFilter !== 'all' && (
                    <span> · status = {STATUS_CONFIG[statusFilter]?.label}</span>
                  )}
                </>
              ) : (
                <>
                  <strong className="text-primary">0</strong> of {cvList.length} CV{cvList.length !== 1 ? 's' : ''} match filters
                  {statusFilter !== 'all' && (
                    <span> · status = {STATUS_CONFIG[statusFilter]?.label}</span>
                  )}
                </>
              )}
            </p>
            {sortedFilteredCvs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No CVs match your search or filters.</p>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Profile</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 whitespace-nowrap">Created</th>
                        <th className="px-4 py-3 w-24"> </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedCvs.map((cv) => {
                        const pid = String(cv.profileId ?? '');
                        const st = cv.application_status || 'saved';
                        return (
                          <tr
                            key={cv._id}
                            onClick={() => navigate(`/cv/${cv._id}`)}
                            className="hover:bg-gray-50 cursor-pointer transition"
                          >
                            <td className="px-4 py-3 font-medium text-primary">{cv.role_title || '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{cv.company_name || '—'}</td>
                            <td className="px-4 py-3 text-gray-600">{cv.job_type || '—'}</td>
                            <td className="px-4 py-3 text-gray-600">{profileLabelById[pid] || '—'}</td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <StatusBadge status={st} />
                            </td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                              {cv.createdAt
                                ? new Date(cv.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                : '—'}
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <Link
                                to={`/cv/${cv._id}`}
                                className="text-xs font-medium text-accent hover:underline"
                              >
                                Open
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 pb-3 bg-gray-50/80 border-t border-gray-100">
                  <Pagination
                    page={cvPage}
                    total={sortedFilteredCvs.length}
                    pageSize={cvPageSize}
                    onChange={setCvPage}
                  />
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
