export default function CVPreview({ cvData, profile }) {
  if (!cvData) return null;

  const { developer_title, summary, skills, experiences } = cvData;

  const skillsMap = skills instanceof Map ? skills : new Map(Object.entries(skills || {}));

  const contactParts = profile
    ? [profile.email, profile.phone, profile.location, profile.linkedin, profile.github, profile.website].filter(Boolean)
    : [];

  // Build experience rows: company/role/date from profile.workExperiences,
  // bullets from cv JSON experiences (experience1, experience2, …)
  // If profile has no workExperiences, fall back to role/company/date keys from the CV JSON itself.
  const workRows = (() => {
    const profileJobs = profile?.workExperiences || [];
    if (profileJobs.length > 0) {
      return profileJobs.map((w, i) => ({
        role: w.role,
        company: w.company,
        date: w.current
          ? `${w.startDate} – Present`
          : [w.startDate, w.endDate].filter(Boolean).join(' – '),
        bullets: experiences?.[`experience${i + 1}`] || [],
      }));
    }
    // Fallback: old-style keys in JSON
    return [1, 2, 3].map((i) => ({
      role: experiences?.[`role${i}`],
      company: experiences?.[`company${i}`],
      date: experiences?.[`date${i}`],
      bullets: experiences?.[`experience${i}`] || [],
    })).filter((r) => r.role);
  })();

  return (
    <div className="font-sans text-sm text-gray-800 space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      {profile ? (
        <div className="text-center border-b-2 border-accent pb-4">
          <h1 className="text-3xl font-bold text-primary">{profile.name}</h1>
          <p className="text-sm font-semibold text-accent mt-1">{developer_title}</p>
          {contactParts.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">{contactParts.join('  |  ')}</p>
          )}
        </div>
      ) : (
        <div className="border-b-2 border-accent pb-3">
          <h1 className="text-2xl font-bold text-primary">{developer_title}</h1>
          <p className="text-xs text-yellow-600 mt-1">Select a profile to see full preview with your name and contact info.</p>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <section>
          <SectionTitle>Professional Summary</SectionTitle>
          <p className="text-sm leading-relaxed text-gray-700">{summary}</p>
        </section>
      )}

      {/* Skills */}
      {skillsMap.size > 0 && (
        <section>
          <SectionTitle>Technical Skills</SectionTitle>
          <div className="space-y-1">
            {Array.from(skillsMap.entries()).map(([cat, items]) => {
              const label = cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <p key={cat} className="text-sm">
                  <span className="font-semibold text-primary">{label}:</span>{' '}
                  <span className="text-gray-700">{Array.isArray(items) ? items.join(', ') : items}</span>
                </p>
              );
            })}
          </div>
        </section>
      )}

      {/* Experience */}
      {workRows.length > 0 && (
        <section>
          <SectionTitle>Professional Experience</SectionTitle>
          <div className="space-y-4">
            {workRows.map((w, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                    <h3 className="font-bold text-primary text-sm whitespace-nowrap">{w.role}</h3>
                    {w.company && (
                      <>
                        <span className="text-gray-300 text-xs">|</span>
                        <span className="text-xs text-accent font-semibold whitespace-nowrap">{w.company}</span>
                      </>
                    )}
                  </div>
                  {w.date && <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{w.date}</span>}
                </div>
                {w.bullets.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 mt-1">
                    {w.bullets.map((b, idx) => (
                      <li key={idx} className="text-sm text-gray-700 leading-snug">{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {profile?.education?.length > 0 && (
        <section>
          <SectionTitle>Education</SectionTitle>
          <div className="space-y-3">
            {profile.education.map((edu, i) => {
              const years = [edu.startYear, edu.endYear].filter(Boolean).join(' – ');
              return (
                <div key={i}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-primary text-sm">{edu.institution}</span>
                    {years && <span className="text-xs text-gray-400">{years}</span>}
                  </div>
                  <p className="text-sm text-gray-600">{[edu.degree, edu.field].filter(Boolean).join(', ')}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Certifications */}
      {profile?.certifications?.length > 0 && (
        <section>
          <SectionTitle>Certifications</SectionTitle>
          <div className="space-y-1">
            {profile.certifications.map((cert, i) => {
              const meta = [cert.issuer, cert.year].filter(Boolean).join(', ');
              return (
                <p key={i} className="text-sm">
                  <span className="font-semibold text-primary">{cert.name}</span>
                  {meta && <span className="text-gray-500"> — {meta}</span>}
                </p>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-accent pb-1 mb-2">
      {children}
    </h2>
  );
}
