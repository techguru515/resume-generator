import { useState, useRef, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateCV from './pages/CreateCV.jsx';
import Workspace from './pages/Workspace.jsx';
import Progress from './pages/Progress.jsx';
import CVDetail from './pages/CVDetail.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminClients from './pages/AdminClients.jsx';
import AdminCVs from './pages/AdminCVs.jsx';
import AdminProgress from './pages/AdminProgress.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
}

const navLink = ({ isActive }) =>
  `relative text-sm font-medium transition-colors px-3 py-1.5 rounded-lg ${
    isActive ? 'bg-white/15 text-white' : 'text-blue-200 hover:text-white hover:bg-white/10'
  }`;

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  function go(path) { setOpen(false); navigate(path); }
  function handleSignOut() { setOpen(false); logout(); navigate('/login'); }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 focus:outline-none"
      >
        <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0 ${
          user?.avatar ? '' : user?.role === 'admin' ? 'bg-yellow-400 text-yellow-900' : 'bg-blue-500 text-white'
        }`}>
          {user?.avatar
            ? <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
            : initials
          }
        </div>
        <span className="text-sm text-blue-100 hidden sm:block">{user?.name}</span>
        <svg className={`w-3 h-3 text-blue-300 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {/* User info */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#0f2744] to-[#1a3a5c] flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-accent text-white text-xs font-bold">
              {user?.avatar
                ? <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                : user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-blue-300 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="py-1">
            <button onClick={() => go('/profile')} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              Profile
            </button>
            <button onClick={() => go('/account')} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Account
            </button>
            <div className="border-t border-gray-100 mx-2 my-1" />
            <button onClick={handleSignOut} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition flex items-center gap-2.5">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Layout() {
  const { user, logout } = useAuth();

  if (user?.role === 'admin' && window.location.pathname === '/') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-gradient-to-r from-[#0f2744] via-[#1a3a5c] to-[#1e4976] text-white px-6 py-0 flex items-center gap-1 shadow-lg border-b border-white/10 h-14">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-6">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-bold text-base tracking-tight text-white">CV Builder</span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {user?.role === 'admin' && (
            <>
              <NavLink to="/admin" end className={navLink}>Dashboard</NavLink>
              <NavLink to="/admin/clients" className={navLink}>Clients</NavLink>
              <NavLink to="/admin/cvs" className={navLink}>CVs</NavLink>
              <NavLink to="/admin/progress" className={navLink}>Progress</NavLink>
            </>
          )}
          {user?.role === 'client' && (
            <>
              <NavLink to="/" end className={navLink}>Dashboard</NavLink>
              <NavLink to="/create" className={navLink}>Create CV</NavLink>
              <NavLink to="/workspace" className={navLink}>Workspace</NavLink>
              <NavLink to="/progress" className={navLink}>Progress</NavLink>
            </>
          )}
        </div>

        <div className="ml-auto">
          {user && <UserMenu user={user} logout={logout} />}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          {/* Client routes */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreateCV /></ProtectedRoute>} />
          <Route path="/workspace" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />

          {/* Shared */}
          <Route path="/cv/:id" element={<ProtectedRoute><CVDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/clients" element={<ProtectedRoute adminOnly><AdminClients /></ProtectedRoute>} />
          <Route path="/admin/cvs" element={<ProtectedRoute adminOnly><AdminCVs /></ProtectedRoute>} />
          <Route path="/admin/progress" element={<ProtectedRoute adminOnly><AdminProgress /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/*" element={<Layout />} />
      </Routes>
    </AuthProvider>
  );
}
