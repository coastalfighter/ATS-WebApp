import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, notificationsAPI } from '../services/api';
import AlertMessage from '../components/common/AlertMessage';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [prefs, setPrefs] = useState({
    email_on_booking: true,
    email_on_assignment: true,
    email_on_interview: true,
    email_on_status_change: true,
    in_app_enabled: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);

  useEffect(() => {
    notificationsAPI.getPreferences()
      .then(({ data }) => setPrefs(data))
      .catch(() => {})
      .finally(() => setPrefsLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const { data } = await authAPI.updateProfile(form);
      updateUser(data);
      setSuccess('Profile updated.');
    } catch (err) {
      setError('Failed to update profile.');
    }
  };

  const handlePrefToggle = async (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      await notificationsAPI.updatePreferences({ [key]: updated[key] });
    } catch {
      setPrefs(prefs);
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

      <div className="table-container p-4 mt-4" style={{ maxWidth: '600px' }}>
        <h5 className="mb-3">
          <i className="bi bi-bell me-2"></i>Notification Preferences
        </h5>
        {prefsLoading ? (
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm"></div>
          </div>
        ) : (
          <div>
            <div className="form-check form-switch mb-2">
              <input className="form-check-input" type="checkbox" checked={prefs.in_app_enabled}
                onChange={() => handlePrefToggle('in_app_enabled')} id="pref_inapp" />
              <label className="form-check-label" htmlFor="pref_inapp">In-app notifications</label>
            </div>
            <div className="form-check form-switch mb-2">
              <input className="form-check-input" type="checkbox" checked={prefs.email_on_assignment}
                onChange={() => handlePrefToggle('email_on_assignment')} id="pref_assignment" />
              <label className="form-check-label" htmlFor="pref_assignment">Email on candidate assignment</label>
            </div>
            <div className="form-check form-switch mb-2">
              <input className="form-check-input" type="checkbox" checked={prefs.email_on_booking}
                onChange={() => handlePrefToggle('email_on_booking')} id="pref_booking" />
              <label className="form-check-label" htmlFor="pref_booking">Email on booking events</label>
            </div>
            <div className="form-check form-switch mb-2">
              <input className="form-check-input" type="checkbox" checked={prefs.email_on_interview}
                onChange={() => handlePrefToggle('email_on_interview')} id="pref_interview" />
              <label className="form-check-label" htmlFor="pref_interview">Email on interview reminders</label>
            </div>
            <div className="form-check form-switch mb-2">
              <input className="form-check-input" type="checkbox" checked={prefs.email_on_status_change}
                onChange={() => handlePrefToggle('email_on_status_change')} id="pref_status" />
              <label className="form-check-label" htmlFor="pref_status">Email on status changes</label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
