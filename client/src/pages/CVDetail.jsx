import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  getCV,
  deleteCV,
  getProfileById,
  updateCVStatus,
  cvChat,
  downloadCoverLetterPdfUrl,
  apiPublicUrl,
} from '../api.js';
import { profileRefToIdString } from '../utils/profileRef.js';
import CVPreview from '../components/CVPreview.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { mimeForDownloadFilename, saveBlobAsFile } from '../utils/saveBlobAsFile.js';

function readPreferSavePicker() {
  try {
    return localStorage.getItem('cvPreferSavePicker') !== 'false';
  } catch {
    return true;
  }
}

const STATUS_CONFIG = {
  saved:     { label: 'Created',   bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400',    border: 'border-gray-300' },
  applied:   { label: 'Applied',   bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-300' },
  interview: { label: 'Interview', bg: 'bg-yellow-50',   text: 'text-yellow-700',  dot: 'bg-yellow-500',  border: 'border-yellow-300' },
  offer:     { label: 'Offer',     bg: 'bg-green-50',    text: 'text-green-700',   dot: 'bg-green-500',   border: 'border-green-300' },
  failed:    { label: 'Failed',    bg: 'bg-rose-50',     text: 'text-rose-700',    dot: 'bg-rose-500',    border: 'border-rose-300' },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

const REMOTE_STATUS_LABELS = {
  Remote: 'Remote',
  Hybrid: 'Hybrid',
  'On-site': 'On-site',
  Unspecified: 'Not specified',
};

function decodeCvCopyPathHeader(copyB64) {
  if (!copyB64 || typeof copyB64 !== 'string') return '';
  try {
    const bin = atob(copyB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

/** @returns {Promise<{ serverCopyPath?: string; cancelled?: boolean }>} */
async function downloadCvArtifact(url, filename, usePickerFirst) {
  const token = localStorage.getItem('token');
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  const serverCopyPath = decodeCvCopyPathHeader(res.headers['x-cv-server-copy-path']);
  const mime = mimeForDownloadFilename(filename);
  const r = await saveBlobAsFile(res.data, filename, { mime, usePickerFirst });
  if (r.via === 'aborted')
    return { serverCopyPath, cancelled: true };
  return { serverCopyPath };
}

async function copyToClipboard(text) {
  const s = String(text || '');
  if (!s) return;
  try {
    await navigator.clipboard.writeText(s);
    return;
  } catch {
    // fallback below
  }
  const ta = document.createElement('textarea');
  ta.value = s;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

function InfoCard({ label, value, highlight }) {
  if (!value) return null;
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-accent' : 'text-primary'}`}>{value}</p>
    </div>
  );
}

function pickerSaveSupported() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

export default function CVDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [cv, setCv] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [activeTab, setActiveTab] = useState('ai');
  const [lastServerCopyPath, setLastServerCopyPath] = useState('');
  const [preferSavePicker, setPreferSavePicker] = useState(() =>
    pickerSaveSupported() ? readPreferSavePicker() : false
  );

  useEffect(() => {
    try {
      localStorage.setItem('cvPreferSavePicker', preferSavePicker ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [preferSavePicker]);

  useEffect(() => {
    getCV(id)
      .then((data) => {
        setCv(data);
        const pid = profileRefToIdString(data.profileId);
        if (pid) getProfileById(pid).then(setProfile).catch(() => {});
      })
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownload(type) {
    setDownloading(type);
    try {
      if (type === 'cover-letter-pdf') {
        const filename = `CoverLetter_${cv.company_name}_${cv.role_title}.pdf`.replace(/[^a-z0-9_.]/gi, '_');
        const { serverCopyPath, cancelled } = await downloadCvArtifact(
          downloadCoverLetterPdfUrl(id),
          filename,
          preferSavePicker
        );
        if (cancelled) return;
        if (serverCopyPath) setLastServerCopyPath(serverCopyPath);
        return;
      }
      const ext = type === 'docx' ? 'docx' : 'pdf';
      const filename = `CV_${cv.company_name}_${cv.role_title}.${ext}`.replace(/[^a-z0-9_.]/gi, '_');
      const { serverCopyPath, cancelled } = await downloadCvArtifact(
        apiPublicUrl(`/cv/${id}/download/${type}`),
        filename,
        preferSavePicker
      );
      if (cancelled) return;
      if (serverCopyPath) setLastServerCopyPath(serverCopyPath);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setDownloading('');
    }
  }

  async function handleStatusChange(status) {
    setUpdatingStatus(true);
    try {
      const updated = await updateCVStatus(id, status);
      setCv((prev) => ({ ...prev, application_status: updated.application_status }));
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this CV?')) return;
    try {
      await deleteCV(id);
      navigate(isAdmin ? '/admin' : '/');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  async function handleAskAi(e) {
    e?.preventDefault?.();
    setAiError('');
    const q = String(aiInput || '').trim();
    if (!q) return;

    const nextHistory = [...aiMessages, { role: 'user', content: q }];
    setAiMessages(nextHistory);
    setAiInput('');
    setAiLoading(true);
    try {
      const resp = await cvChat({ cvId: id, message: q, history: nextHistory });
      const answer = String(resp?.answer || '').trim() || '(No response)';
      setAiMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      setAiError(err.response?.data?.error || err.message || 'AI request failed');
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) return <p className="text-gray-400 p-4">Loading…</p>;
  if (error)   return <p className="text-red-500 p-4">{error}</p>;
  if (!cv)     return null;

  const status = cv.application_status || 'saved';
  const cfg = STATUS_CONFIG[status];
  const hasJd = Boolean(String(cv.job_description || '').trim());
  const hasCoverLetter = Boolean(String(cv.cover_letter || '').trim());

  const tabs = [
    { key: 'ai', label: 'AI Assistant', show: true },
    { key: 'preview', label: 'CV Preview', show: true },
    { key: 'jd', label: 'Job Description', show: hasJd },
    { key: 'cover', label: 'Cover Letter', show: hasCoverLetter },
  ].filter((t) => t.show);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate(isAdmin ? '/admin/cvs' : '/')}
          className="text-sm text-gray-500 hover:text-primary flex items-center gap-1"
        >
          ← Back
        </button>
        <div className="flex flex-wrap gap-2">
          {!isAdmin && (
            <>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer shrink-0 order-last sm:order-none w-full sm:w-auto mr-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-accent focus:ring-accent shrink-0"
                  checked={preferSavePicker}
                  onChange={(e) => setPreferSavePicker(e.target.checked)}
                  disabled={!pickerSaveSupported()}
                />
                <span title="Opens your system Save dialog so you choose folder & filename (Chrome/Edge over HTTPS).">
                  Pick save location (Save&nbsp;As)
                </span>
              </label>
              {!pickerSaveSupported() && (
                <span className="text-[11px] text-gray-500 max-w-md leading-snug">
                  This browser does not support choosing a folder from the page. Use Chrome or Edge, or enable
                  &quot;Ask where to save each file&quot; in your browser&apos;s download settings.
                </span>
              )}
              <button
                onClick={() => handleDownload('docx')}
                disabled={!!downloading}
                className="bg-accent text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
              >
                {downloading === 'docx' ? 'Downloading…' : 'Download DOCX'}
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                disabled={!!downloading}
                className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-900 disabled:opacity-50 transition font-medium"
              >
                {downloading === 'pdf' ? 'Downloading…' : 'Download PDF'}
              </button>
              <button
                onClick={() => handleDownload('cover-letter-pdf')}
                disabled={!!downloading || !cv.cover_letter}
                className="bg-white text-primary text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition font-medium"
                title={!cv.cover_letter ? 'No cover letter available for this CV.' : ''}
              >
                {downloading === 'cover-letter-pdf' ? 'Downloading…' : 'Download Cover Letter'}
              </button>
              <button
                onClick={handleDelete}
                className="text-sm text-red-500 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {lastServerCopyPath ? (
        <p className="text-[11px] text-gray-500 -mt-4 max-w-5xl mx-auto">
          Server-side copy (where the API runs):{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px] break-all">{lastServerCopyPath}</code>
        </p>
      ) : null}

      {/* Job Info Dashboard Card */}
      <div className={`rounded-2xl shadow border ${cfg.border} ${cfg.bg} p-6 space-y-5`}>
        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary leading-tight">{cv.role_title}</h1>
            <p className="text-sm text-gray-500 mt-1">{cv.developer_title}</p>
          </div>
          {/* Status badge + changer */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <InfoCard label="Company"      value={cv.company_name} />
          <InfoCard label="Job Type"     value={cv.job_type} />
          <InfoCard
            label="Work mode"
            value={REMOTE_STATUS_LABELS[cv.remote_status] || REMOTE_STATUS_LABELS.Unspecified}
          />
          <InfoCard label="Salary Range" value={cv.salary_range || 'Not specified'} />
          <InfoCard label="Applied On"   value={new Date(cv.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
        </div>

        {/* Profile used */}
        {profile && (
          <div className="bg-white rounded-lg px-4 py-3 border border-gray-100">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Profile Used</p>
            <p className="text-sm font-semibold text-primary">{profile.label}</p>
            <p className="text-xs text-gray-500">{profile.name} · {profile.email}{profile.phone ? ` · ${profile.phone}` : ''}</p>
          </div>
        )}

        {/* Job link */}
        {cv.job_link && (
          <div className="bg-white rounded-lg px-4 py-3 border border-gray-100">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Job Posting</p>
            <a
              href={cv.job_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline break-all"
            >
              {cv.job_link} ↗
            </a>
          </div>
        )}

        {/* Status pipeline */}
        {!isAdmin && (
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => {
                const c = STATUS_CONFIG[s];
                const active = status === s;
                return (
                  <button
                    key={s}
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      active
                        ? `${c.bg} ${c.text} ${c.border} shadow-sm`
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    } disabled:opacity-50`}
                  >
                    {active && <span className="mr-1">✓</span>}{c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detail tabs */}
      <div className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
        <div className="px-4 pt-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="CV details tabs">
            {tabs.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    active ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {/* AI tab */}
          {activeTab === 'ai' && (
            <div className="space-y-4" role="tabpanel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-primary">AI Assistant</h2>
                  <p className="text-xs text-gray-500">Uses this CV + the saved job description.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setAiMessages([]); setAiError(''); }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
                >
                  Clear
                </button>
              </div>

              {aiError ? (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                  {aiError}
                </div>
              ) : null}

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 h-64 overflow-auto space-y-2">
                {aiMessages.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Try: “Rewrite my summary for this JD”, “List missing keywords”, “Improve bullet points for this role”.
                  </p>
                ) : (
                  aiMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`text-sm leading-relaxed rounded-lg px-3 py-2 border ${
                        m.role === 'assistant'
                          ? 'bg-white border-gray-200 text-gray-800'
                          : 'bg-blue-50 border-blue-100 text-blue-900'
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1">
                        {m.role === 'assistant' ? 'Assistant' : 'You'}
                      </div>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ))
                )}
                {aiLoading ? <div className="text-sm text-gray-500 px-2 py-1">Thinking…</div> : null}
              </div>

              <form onSubmit={handleAskAi} className="flex gap-2">
                <input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ask something…"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={aiLoading}
                />
                <button
                  type="submit"
                  disabled={aiLoading || !String(aiInput || '').trim()}
                  className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-900 disabled:opacity-50 transition font-medium"
                >
                  Send
                </button>
              </form>
            </div>
          )}

          {/* Preview tab */}
          {activeTab === 'preview' && (
            <div role="tabpanel">
              <h2 className="text-base font-bold text-primary mb-6 border-b pb-3">CV Preview</h2>
              <CVPreview cvData={cv} profile={profile} />
            </div>
          )}

          {/* JD tab */}
          {activeTab === 'jd' && hasJd && (
            <div role="tabpanel">
              <h2 className="font-bold text-primary mb-3">Job Description</h2>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{cv.job_description}</pre>
            </div>
          )}

          {/* Cover tab */}
          {activeTab === 'cover' && hasCoverLetter && (
            <div role="tabpanel">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-bold text-primary">Cover Letter</h2>
                <button
                  type="button"
                  onClick={() => copyToClipboard(cv.cover_letter)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
                  title="Copy cover letter to clipboard"
                >
                  Copy
                </button>
              </div>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{cv.cover_letter}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
