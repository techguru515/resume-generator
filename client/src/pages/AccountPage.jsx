import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword, updateAvatar } from '../api.js';

function AvatarSection({ user, updateUser }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }

    setError('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setUploading(true);
      try {
        const result = await updateAvatar(base64);
        updateUser({ avatar: result.avatar });
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  }

  async function handleRemove() {
    setUploading(true);
    try {
      await updateAvatar('');
      updateUser({ avatar: '' });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setUploading(false); }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 border-b pb-2">Avatar</h3>
      <div className="flex items-center gap-5">
        {/* Avatar preview */}
        <div
          className={`w-20 h-20 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${
            user?.avatar ? '' : user?.role === 'admin' ? 'bg-yellow-400' : 'bg-accent'
          }`}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-white">{initials}</span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-sm bg-accent text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
            >
              {uploading ? 'Uploading…' : user?.avatar ? 'Change Photo' : 'Upload Photo'}
            </button>
            {user?.avatar && (
              <button
                onClick={handleRemove}
                disabled={uploading}
                className="text-sm text-red-500 border border-red-200 px-4 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">JPG, PNG, GIF</p>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.newPassword !== form.confirmPassword) return setError('New passwords do not match');
    if (form.newPassword.length < 6) return setError('New password must be at least 6 characters');
    setSaving(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-md space-y-4">

      {/* Account info */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold text-primary mb-4">Account</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Name</span>
            <span className="font-medium text-gray-800">{user?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Email</span>
            <span className="font-medium text-gray-800">{user?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Role</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              user?.role === 'admin' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-700'
            }`}>{user?.role}</span>
          </div>
        </div>
      </div>

      {/* Avatar */}
      <AvatarSection user={user} updateUser={updateUser} />

      {/* Change password */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 border-b pb-2">Change Password</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'currentPassword', label: 'Current Password' },
            { key: 'newPassword', label: 'New Password' },
            { key: 'confirmPassword', label: 'Confirm New Password' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="password" value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          ))}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}
          <button type="submit" disabled={saving}
            className="bg-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
