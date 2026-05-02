/**
 * Shared CV PDF/HTML document metadata (title, author, ATS keyword blob).
 */

function buildMetadata(cvData, profile) {
  const skillsMap = cvData.skills instanceof Map ? cvData.skills : new Map(Object.entries(cvData.skills || {}));
  const allSkills = Array.from(skillsMap.values()).flat();
  const roles = profile.workExperiences?.map((w) => w.role) || [];
  const companies = profile.workExperiences?.map((w) => w.company) || [];
  const certNames = profile.certifications?.map((c) => c.name) || [];

  return {
    title: `${profile.name} – ${cvData.role_title || cvData.developer_title}`,
    author: profile.name,
    subject: cvData.developer_title || cvData.role_title,
    keywords: [
      cvData.role_title,
      cvData.developer_title,
      cvData.remote_status,
      ...allSkills,
      ...roles,
      ...companies,
      ...certNames,
    ]
      .filter(Boolean)
      .join(', '),
  };
}

module.exports = { buildMetadata };
