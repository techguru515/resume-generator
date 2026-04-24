import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { adminListUsers, adminGetUserCVs, adminGetUserProfiles, updateCVStatus } from '../api.js';

const STATUS_CONFIG = {
  saved:     { label: 'Saved',     bg: 'bg-gray-50',   border: 'border-gray-200',   heading: 'text-gray-600',   dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600' },
  applied:   { label: 'Applied',   bg: 'bg-blue-50',   border: 'border-blue-200',   heading: 'text-blue-700',   dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700' },
  interview: { label: 'Interview', bg: 'bg-yellow-50', border: 'border-yellow-200', heading: 'text-yellow-700', dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' },
  offer:     { label: 'Offer',     bg: 'bg-green-50',  border: 'border-green-200',  heading: 'text-green-700',  dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  bg: 'bg-red-50',    border: 'border-red-200',    heading: 'text-red-600',    dot: 'bg-red-400',    badge: 'bg-red-100 text-red-500' },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

function CVCard({ cv, isDragging, navigate, profileLabel }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: String(cv._id) });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50, opacity: 0.85 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2 select-none cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : 'hover:shadow-md'} transition`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-primary text-xs leading-snug truncate">{cv.role_title}</p>
        <p className="text-xs text-gray-500 truncate">{cv.company_name} · {cv.job_type}</p>
        {cv.salary_range && <p className="text-xs text-gray-400">{cv.salary_range}</p>}
        {profileLabel && (
          <p className="text-xs text-accent mt-0.5 truncate">{profileLabel}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date(cv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      <div
        className="flex items-center gap-2 pt-1 border-t border-gray-50"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {cv.job_link && (
          <a href={cv.job_link} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
            Posting ↗
          </a>
        )}
        <button
          onClick={() => navigate(`/cv/${cv._id}`)}
          className="ml-auto text-xs bg-accent text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          View
        </button>
      </div>
    </div>
  );
}

function DragGhostCard({ cv }) {
  if (!cv) return null;
  return (
    <div className="bg-white rounded-xl border border-accent shadow-xl p-3 w-52 rotate-2 opacity-95">
      <p className="font-semibold text-primary text-xs truncate">{cv.role_title}</p>
      <p className="text-xs text-gray-500 truncate">{cv.company_name}</p>
    </div>
  );
}

function KanbanColumn({ status, cvs, activeId, navigate, profileMap }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 transition-colors ${cfg.bg} ${isOver ? 'border-accent' : cfg.border} p-3 flex flex-col gap-3 min-h-[200px]`}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className={`text-xs font-bold uppercase tracking-wide ${cfg.heading}`}>{cfg.label}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cvs.length}</span>
      </div>

      {cvs.length === 0 ? (
        <div className={`flex-1 flex items-center justify-center rounded-xl border-2 border-dashed ${
          isOver ? 'border-accent bg-blue-50' : 'border-gray-200'
        } transition-colors py-8`}>
          <p className="text-xs text-gray-300">Drop here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] pr-0.5">
          {cvs.map((cv) => (
            <CVCard
              key={cv._id}
              cv={cv}
              isDragging={String(activeId) === String(cv._id)}
              navigate={navigate}
              profileLabel={profileMap[cv.profileId?.toString()]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminProgress() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(searchParams.get('client') || '');
  const [profiles, setProfiles] = useState([]);
  const [cvList, setCvList] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Load client list
  useEffect(() => {
    adminListUsers().then(setClients).finally(() => setLoadingClients(false));
  }, []);

  // Load CVs + profiles when client changes
  useEffect(() => {
    if (!selectedClientId) { setCvList([]); setProfiles([]); setSelectedProfileId(''); return; }
    setLoadingBoard(true);
    setSelectedProfileId('');
    Promise.all([adminGetUserCVs(selectedClientId), adminGetUserProfiles(selectedClientId)])
      .then(([cvs, profs]) => { setCvList(cvs); setProfiles(profs); })
      .finally(() => setLoadingBoard(false));
  }, [selectedClientId]);

  function handleClientSelect(id) {
    setSelectedClientId(id);
    setSearchParams(id ? { client: id } : {});
  }

  // Profile label map: profileId → label
  const profileMap = Object.fromEntries(profiles.map((p) => [p._id.toString(), p.label]));

  // Filter CVs by selected profile
  const visibleCvs = selectedProfileId
    ? cvList.filter((c) => c.profileId?.toString() === selectedProfileId)
    : cvList;

  const grouped = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = visibleCvs.filter((c) => (c.application_status || 'saved') === s);
    return acc;
  }, {});

  const activeCv = activeId ? cvList.find((c) => String(c._id) === String(activeId)) : null;
  const selectedClient = clients.find((c) => c._id === selectedClientId);

  function handleDragStart({ active }) { setActiveId(active.id); }

  async function handleDragEnd({ active, over }) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const newStatus = over.id;
    if (!ALL_STATUSES.includes(newStatus)) return;
    const aid = String(active.id);
    const cv = cvList.find((c) => String(c._id) === aid);
    if (!cv || (cv.application_status || 'saved') === newStatus) return;

    setCvList((prev) => prev.map((c) => (String(c._id) === aid ? { ...c, application_status: newStatus } : c)));

    try {
      await updateCVStatus(aid, newStatus);
    } catch (err) {
      setCvList((prev) => prev.map((c) => (String(c._id) === aid ? { ...c, application_status: cv.application_status || 'saved' } : c)));
      alert(err.response?.data?.error || err.message);
    }
  }

  if (loadingClients) return <p className="text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-primary">Progress</h2>

      {/* Client selector */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Client</p>
        {clients.length === 0 ? (
          <p className="text-gray-400 text-sm">No clients yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {clients.map((c) => (
              <button
                key={c._id}
                onClick={() => handleClientSelect(c._id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition font-medium ${
                  selectedClientId === c._id
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-accent hover:text-accent'
                }`}
              >
                {c.name}
                <span className="ml-1.5 text-xs opacity-70">({c.cvCount})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Profile filter — shown only when a client is selected and has multiple profiles */}
      {selectedClientId && profiles.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {selectedClient?.name}'s Profiles
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedProfileId('')}
              className={`px-3 py-1 rounded-lg text-xs border transition font-medium ${
                !selectedProfileId ? 'bg-accent text-white border-accent' : 'border-gray-200 text-gray-600 hover:border-accent hover:text-accent'
              }`}
            >
              All Profiles
              <span className="ml-1 opacity-70">({cvList.length})</span>
            </button>
            {profiles.map((p) => {
              const count = cvList.filter((c) => c.profileId?.toString() === p._id.toString()).length;
              return (
                <button
                  key={p._id}
                  onClick={() => setSelectedProfileId(p._id)}
                  className={`px-3 py-1 rounded-lg text-xs border transition font-medium ${
                    selectedProfileId === p._id
                      ? 'bg-accent text-white border-accent'
                      : 'border-gray-200 text-gray-600 hover:border-accent hover:text-accent'
                  }`}
                >
                  {p.label}
                  <span className="ml-1 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Board area */}
      {!selectedClientId && (
        <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
          <p className="text-sm">Select a client above to view their application progress.</p>
        </div>
      )}

      {selectedClientId && loadingBoard && (
        <p className="text-gray-400">Loading board…</p>
      )}

      {selectedClientId && !loadingBoard && (
        <>
          {visibleCvs.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
              <p className="text-sm">No CVs found for this selection.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400">
                Drag a card to update the application status. Click <strong>View</strong> to see the full CV.
              </p>
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
                  {ALL_STATUSES.map((s) => (
                    <KanbanColumn
                      key={s}
                      status={s}
                      cvs={grouped[s]}
                      activeId={activeId}
                      navigate={navigate}
                      profileMap={profileMap}
                    />
                  ))}
                </div>
                <DragOverlay dropAnimation={null}>
                  <DragGhostCard cv={activeCv} />
                </DragOverlay>
              </DndContext>
            </>
          )}
        </>
      )}
    </div>
  );
}
