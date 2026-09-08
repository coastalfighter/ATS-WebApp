import { useState } from 'react';
import { authAPI } from '../services/api';
import AlertMessage from '../components/common/AlertMessage';

export default function ChangePasswordPage() {
  const [form, setForm] = useState({
    old_password: '',
    new_password: '',
    new_password_confirm: '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await authAPI.changePassword(form);
      setSuccess('Password changed successfully.');
      setForm({ old_password: '', new_password: '', new_password_confirm: '' });
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setError(msgs.join(' | '));
      } else {
        setError('Failed to change password.');
      }
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Change Password</h1>
      </div>
      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="table-container p-4" style={{ maxWidth: '500px' }}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-control form-control-sm" required
                value={form.old_password}
                onChange={(e) => setForm({ ...form, old_password: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">New Password</label>
              <input type="password" className="form-control form-control-sm" required
                value={form.new_password}
                onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Confirm New Password</label>
              <input type="password" className="form-control form-control-sm" required
                value={form.new_password_confirm}
                onChange={(e) => setForm({ ...form, new_password_confirm: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm d-flex align-items-center gap-1">
              <i className="bi bi-shield-check"></i> Change Password
            </button>
          </form>
      </div>
    </div>
  );
}
