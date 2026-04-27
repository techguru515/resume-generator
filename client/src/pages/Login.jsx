import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login as apiLogin } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await apiLogin(form);
      login(token, user);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-primary mb-6 text-center">Resume Generator</h1>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Sign In</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-sm text-gray-500 text-center mt-4">
          No account?{' '}
          <Link to="/register" className="text-accent hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
