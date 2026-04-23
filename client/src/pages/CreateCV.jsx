import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveCV, listProfiles } from '../api.js';
import CVPreview from '../components/CVPreview.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const PLACEHOLDER = JSON.stringify(
  {
    role_title: 'Senior Backend Engineer',
    developer_title: 'Senior Backend Engineer (GenAI Platform)',
    company_name: 'OLX Group',
    job_type: 'Permanent',
    salary_range: '$120k–$150k',
    summary: 'Experienced backend engineer with 8+ years building scalable systems...',
    skills: {
      programming_languages: ['Python', 'Go', 'TypeScript'],
      frameworks: ['FastAPI', 'Express'],
      cloud: ['AWS', 'GCP'],
    },
    experiences: {
      experience1: ['Led migration of monolith to microservices...', 'Reduced p99 latency by 40%...'],
      experience2: ['Built real-time data pipeline processing 1M events/day...'],
      experience3: ['Developed REST APIs for mobile app...'],
    },
  },
  null, 2
);

export default function CreateCV() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [jobLink, setJobLink] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listProfiles().then((data) => {
      setProfiles(data);
      if (data.length > 0) { setSelectedProfileId(data[0]._id); setSelectedProfile(data[0]); }
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

  function handleParse(e) {
    e.preventDefault();
    setParseError('');
    try { setPreview(JSON.parse(jsonInput)); }
    catch (err) { setParseError('Invalid JSON: ' + err.message); }
  }

  async function handleSave() {
    if (!preview || !selectedProfileId) return;
    setSaving(true);
    try {
      const saved = await saveCV({ ...preview, profileId: selectedProfileId, job_link: jobLink });
      navigate(`/cv/${saved._id}`);
    } catch (err) {
      setParseError(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-primary">Create CV</h2>

      <div className="grid md:grid-cols-[2fr_3fr] gap-6">
        {/* Left — inputs */}
        <div className="space-y-5">

          {/* Job Link */}
          <div className="bg-white rounded-2xl shadow p-5 space-y-1">
            <label className="block text-sm font-semibold text-gray-700">Job Link</label>
            <p className="text-xs text-gray-400 mb-2">Paste the URL of the job posting you're applying for.</p>
            <input
              type="url"
              value={jobLink}
              onChange={(e) => setJobLink(e.target.value)}
              placeholder="https://linkedin.com/jobs/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Profile selector */}
          <div className="bg-white rounded-2xl shadow p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Select Profile</label>
            <p className="text-xs text-gray-400 mb-3">Choose which profile (name, contact, work experience, education, certifications) to attach.</p>
            {profiles.length === 0 ? (
              <p className="text-yellow-600 text-sm">
                No profiles yet. <a href="/profile" className="underline">Create one →</a>
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

          {/* JSON input */}
          <div className="bg-white rounded-2xl shadow p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">CV JSON</label>
            <p className="text-xs text-gray-400 mb-3">
              Paste your generated CV JSON. Include <code className="bg-gray-100 px-1 rounded">role_title</code>, <code className="bg-gray-100 px-1 rounded">company_name</code>, <code className="bg-gray-100 px-1 rounded">summary</code>, <code className="bg-gray-100 px-1 rounded">skills</code>, and <code className="bg-gray-100 px-1 rounded">experience1</code>… bullets.
            </p>
            <form onSubmit={handleParse} className="space-y-3">
              <textarea
                value={jsonInput}
                onChange={(e) => { setJsonInput(e.target.value); setParseError(''); setPreview(null); }}
                placeholder={PLACEHOLDER}
                rows={18}
                spellCheck={false}
                className="w-full border border-gray-300 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-y"
              />
              {parseError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{parseError}</div>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!jsonInput.trim()}
                  className="bg-accent text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm"
                >
                  Preview
                </button>
                {preview && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !selectedProfileId}
                    className="bg-green-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition text-sm"
                  >
                    {saving ? 'Saving…' : 'Save CV'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right — preview */}
        <div>
          {preview ? (
            <div className="bg-white rounded-2xl shadow p-6 sticky top-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-4">Full Preview</p>
              <CVPreview cvData={preview} profile={selectedProfile} />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-300 sticky top-4">
              <p className="text-4xl mb-3">📄</p>
              <p className="text-sm">Paste your JSON and click Preview to see the full CV here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
