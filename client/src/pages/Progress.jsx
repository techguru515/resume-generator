import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { listCVs, updateCVStatus } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_CONFIG = {
  saved:     { label: 'Saved',     bg: 'bg-gray-50',   border: 'border-gray-200',   heading: 'text-gray-600',   dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600',    chart: '#9ca3af' },
  applied:   { label: 'Applied',   bg: 'bg-blue-50',   border: 'border-blue-200',   heading: 'text-blue-700',   dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700',    chart: '#3b82f6' },
  interview: { label: 'Interview', bg: 'bg-yellow-50', border: 'border-yellow-200', heading: 'text-yellow-700', dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700', chart: '#f59e0b' },
  offer:     { label: 'Offer',     bg: 'bg-green-50',  border: 'border-green-200',  heading: 'text-green-700',  dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700',   chart: '#22c55e' },
  rejected:  { label: 'Rejected',  bg: 'bg-red-50',    border: 'border-red-200',    heading: 'text-red-600',    dot: 'bg-red-400',    badge: 'bg-red-100 text-red-500',      chart: '#ef4444' },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

// Individual draggable CV card — entire card is the drag surface
function CVCard({ cv, isDragging, navigate }) {
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
        <p className="text-xs text-gray-500 truncate">
          {[
            cv.company_name,
            cv.job_type,
            cv.remote_status && cv.remote_status !== 'Unspecified' ? cv.remote_status : null,
          ].filter(Boolean).join(' · ')}
        </p>
        {cv.salary_range && <p className="text-xs text-gray-400">{cv.salary_range}</p>}
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date(cv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Actions — stop propagation so clicks don't trigger drag */}
      <div
        className="flex items-center gap-2 pt-1 border-t border-gray-50"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {cv.job_link && (
          <a
            href={cv.job_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline"
          >
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

// Ghost card shown in DragOverlay while dragging
function DragGhostCard({ cv }) {
  if (!cv) return null;
  return (
    <div className="bg-white rounded-xl border border-accent shadow-xl p-3 w-52 rotate-2 opacity-95">
      <p className="font-semibold text-primary text-xs truncate">{cv.role_title}</p>
      <p className="text-xs text-gray-500 truncate">{cv.company_name}</p>
    </div>
  );
}

// Droppable column
function KanbanColumn({ status, cvs, activeId, navigate }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 transition-colors ${cfg.bg} ${
        isOver ? 'border-accent' : cfg.border
      } p-3 flex flex-col gap-3 min-h-[200px]`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className={`text-xs font-bold uppercase tracking-wide ${cfg.heading}`}>{cfg.label}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cvs.length}</span>
      </div>

      {/* Cards */}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Progress() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cvList, setCvList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    if (!user?.isApproved && user?.role !== 'admin') { setLoading(false); return; }
    listCVs().then(setCvList).finally(() => setLoading(false));
  }, [user]);

  if (!user?.isApproved && user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-xl font-bold text-primary mb-2">Pending Approval</h2>
        <p className="text-gray-500 max-w-sm">An admin needs to approve your account first.</p>
      </div>
    );
  }

  if (loading) return <p className="text-gray-400">Loading…</p>;

  const grouped = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = cvList.filter((c) => (c.application_status || 'saved') === s);
    return acc;
  }, {});

  const activeCv = activeId ? cvList.find((c) => String(c._id) === String(activeId)) : null;
  const total = cvList.length;

  function handleDragStart({ active }) {
    setActiveId(active.id);
  }

  async function handleDragEnd({ active, over }) {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const newStatus = over.id; // over.id is the column status key
    if (!ALL_STATUSES.includes(newStatus)) return;

    const aid = String(active.id);
    const cv = cvList.find((c) => String(c._id) === aid);
    if (!cv || (cv.application_status || 'saved') === newStatus) return;

    // Optimistic update
    setCvList((prev) =>
      prev.map((c) => (String(c._id) === aid ? { ...c, application_status: newStatus } : c))
    );

    try {
      await updateCVStatus(aid, newStatus);
    } catch (err) {
      // Revert on failure
      setCvList((prev) =>
        prev.map((c) => (String(c._id) === aid ? { ...c, application_status: cv.application_status || 'saved' } : c))
      );
      alert(err.response?.data?.error || err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">Application Progress</h2>
        <span className="text-sm text-gray-400">{total} application{total !== 1 ? 's' : ''} total</span>
      </div>

      {/* Pipeline overview bar */}
      {total > 0 && (
        <div className="bg-white rounded-2xl shadow p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pipeline Overview</p>
          <div className="flex rounded-full overflow-hidden h-3">
            {ALL_STATUSES.map((s) => {
              const pct = (grouped[s].length / total) * 100;
              const colors = { saved: 'bg-gray-300', applied: 'bg-blue-400', interview: 'bg-yellow-400', offer: 'bg-green-500', rejected: 'bg-red-400' };
              if (pct === 0) return null;
              return <div key={s} style={{ width: `${pct}%` }} className={`${colors[s]} transition-all`} title={`${STATUS_CONFIG[s].label}: ${grouped[s].length}`} />;
            })}
          </div>
          <div className="flex flex-wrap gap-4">
            {ALL_STATUSES.map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
                <span className="text-xs text-gray-600">{STATUS_CONFIG[s].label} <span className="font-bold">{grouped[s].length}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">Drag a card to move it between columns. Click <strong>View</strong> to see the full CV.</p>

      {/* Kanban board */}
      {total === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
          <p className="text-sm mb-2">No CVs yet.</p>
          <a href="/create" className="text-accent hover:underline text-sm">Create your first CV →</a>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
            {ALL_STATUSES.map((s) => (
              <KanbanColumn
                key={s}
                status={s}
                cvs={grouped[s]}
                activeId={activeId}
                navigate={navigate}
              />
            ))}
          </div>

          {/* Ghost card that follows cursor while dragging */}
          <DragOverlay dropAnimation={null}>
            <DragGhostCard cv={activeCv} />
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
