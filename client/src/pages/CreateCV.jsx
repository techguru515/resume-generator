import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveCV, listProfiles, generateCvWithAi } from '../api.js';
import CVPreview from '../components/CVPreview.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function CreateCV() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [jobLink, setJobLink] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const blocking = aiLoading || saving;

  useEffect(() => {
    listProfiles().then((data) => {
      setProfiles(data);
      if (data.length > 0) {
        setSelectedProfileId(String(data[0]._id));
        setSelectedProfile(data[0]);
      }
    }).catch(() => {});
  }, []);

  if (!user?.isApproved && user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-xl font-bold text-primary mb-2">Pending Approval</h2>
        <p className="text-gray-500 max-w-sm">An admin needs to approve your account first.</p>
      </div>
    );
  }

  async function handleGenerateAi() {
    if (!selectedProfileId) {
      setError('Select a profile first.');
      return;
    }
    const jd = jobDescription.trim();
    if (!jd) {
      setError('Paste the job description to generate a draft.');
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const data = await generateCvWithAi({
        job_description: jd,
        job_link: jobLink.trim() || undefined,
        profileId: selectedProfileId,
      });
      setPreview(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setPreview(null);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    if (!preview || !selectedProfileId) return;
    setSaving(true);
    setError('');
    try {
      const saved = await saveCV({
        ...preview,
        profileId: selectedProfileId,
        job_link: jobLink,
      });
      navigate(`/cv/${saved._id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      {blocking && (
        <div
          className="fixed inset-0 z-50 bg-white/70 backdrop-blur-[2px] flex items-center justify-center"
          role="status"
          aria-live="polite"
          aria-label={aiLoading ? 'Generating resume…' : 'Saving…'}
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-accent" />
            <p className="text-sm font-semibold text-primary">
              {aiLoading ? 'Generating resume…' : 'Saving…'}
            </p>
            <p className="text-xs text-gray-500">Please wait.</p>
          </div>
        </div>
      )}
      <h2 className="text-xl font-bold text-primary">Create CV</h2>

      <div className="grid md:grid-cols-[2fr_3fr] gap-6">
        <div className="space-y-5">

          <div className="bg-white rounded-2xl shadow p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Select Profile</label>
            <p className="text-xs text-gray-400 mb-3">Used for contact details, work history layout, education, and certifications.</p>
            {profiles.length === 0 ? (
              <p className="text-yellow-600 text-sm">
                No profiles yet. <a href="/profile" className="underline">Create one →</a>
              </p>
            ) : (
              <div className="space-y-2">
                {profiles.map((p) => {
                  const active = String(selectedProfileId) === String(p._id);
                  return (
                    <div
                      key={p._id}
                      onClick={() => { setSelectedProfileId(String(p._id)); setSelectedProfile(p); }}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        active ? 'border-accent bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        active ? 'border-accent bg-accent' : 'border-gray-300'
                      }`}>
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

          <div className="bg-white rounded-2xl shadow p-5 space-y-1">
            <label className="block text-sm font-semibold text-gray-700">Job Link</label>
            <p className="text-xs text-gray-400 mb-2">Optional — helps tailor the draft.</p>
            <input
              type="url"
              value={jobLink}
              onChange={(e) => setJobLink(e.target.value)}
              placeholder="https://linkedin.com/jobs/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="bg-white rounded-2xl shadow p-5 space-y-3 border border-violet-100">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>✨</span>
              <label className="block text-sm font-semibold text-gray-700">Generate with OpenAI</label>
            </div>
            <p className="text-xs text-gray-400">
              Paste any job text (messy paste is fine). The server calls OpenAI once with your profile and this text (requires <strong className="text-gray-600">OPENAI_API_KEY</strong>).
            </p>
            <textarea
              value={jobDescription}
              onChange={(e) => { setJobDescription(e.target.value); setError(''); }}
              placeholder="Requirements, responsibilities, company intro…"
              rows={10}
              spellCheck
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
            />
            <button
              type="button"
              onClick={handleGenerateAi}
              disabled={aiLoading || !selectedProfileId || profiles.length === 0}
              className="w-full sm:w-auto bg-violet-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50 transition text-sm"
            >
              {aiLoading ? 'Generating…' : 'Generate draft'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          )}

          {preview && (
            <div className="bg-white rounded-2xl shadow p-5">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !selectedProfileId}
                className="w-full sm:w-auto bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition text-sm"
              >
                {saving ? 'Saving…' : 'Save CV'}
              </button>
            </div>
          )}
        </div>

        <div>
          {preview ? (
            <div className="bg-white rounded-2xl shadow p-6 sticky top-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-4">Preview</p>
              <CVPreview cvData={preview} profile={selectedProfile} />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-300 sticky top-4">
              <p className="text-4xl mb-3">📄</p>
              <p className="text-sm text-gray-500">
                Paste the job description and click <span className="font-medium text-gray-600">Generate draft</span> to see your CV here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
