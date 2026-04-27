import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register as apiRegister } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await apiRegister(form);
      login(token, user);
      navigate('/');
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
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Create Account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
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
            placeholder="Password (min 6 chars)"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            minLength={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'Creating account…' : 'Register'}
          </button>
        </form>
        <p className="text-sm text-gray-500 text-center mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Sign In
          </Link>
        </p>
        <p className="text-xs text-gray-400 text-center mt-2">
          Your account needs admin approval before you can generate CVs.
        </p>
      </div>
    </div>
  );
}
