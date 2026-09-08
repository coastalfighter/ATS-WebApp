import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import AlertMessage from '../components/common/AlertMessage';

export default function ProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await authAPI.updateProfile(form);
      setSuccess('Profile updated.');
    } catch (err) {
      setError('Failed to update profile.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>My Profile</h1>
      </div>
      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="table-container p-4" style={{ maxWidth: '600px' }}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input className="form-control form-control-sm" value={user?.username || ''} disabled />
            </div>
            <div className="mb-3">
              <label className="form-label">Role</label>
              <input className="form-control form-control-sm text-capitalize" value={user?.role || ''} disabled />
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <label className="form-label">First Name</label>
                <input className="form-control form-control-sm"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Last Name</label>
                <input className="form-control form-control-sm"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control form-control-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Phone</label>
              <input className="form-control form-control-sm"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm d-flex align-items-center gap-1">
              <i className="bi bi-check-lg"></i> Update Profile
            </button>
          </form>
      </div>
    </div>
  );
}
