import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, notificationsAPI, integrationsAPI } from '../services/api';
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

  // RingCentral connection state
  const [rcStatus, setRcStatus] = useState({ is_connected: false, rc_email: '', rc_phone_number: '' });
  const [rcLoading, setRcLoading] = useState(true);
  const [rcConnecting, setRcConnecting] = useState(false);
  const [rcDisconnecting, setRcDisconnecting] = useState(false);
  const [rcError, setRcError] = useState('');

  useEffect(() => {
    notificationsAPI.getPreferences()
      .then(({ data }) => setPrefs(data))
      .catch(() => {})
      .finally(() => setPrefsLoading(false));
  }, []);

  // Load RC connection status
  useEffect(() => {
    integrationsAPI.rcConnection()
      .then(({ data }) => setRcStatus(data))
      .catch(() => {})
      .finally(() => setRcLoading(false));
  }, []);

  // Handle OAuth callback (code in URL params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      window.history.replaceState({}, '', window.location.pathname);
      setRcConnecting(true);
      integrationsAPI.rcCallback({
        code,
        redirect_uri: window.location.origin + '/profile',
      })
        .then(({ data }) => {
          setRcStatus({
            is_connected: true,
            rc_email: data.rc_email,
            rc_phone_number: data.rc_phone_number,
          });
          setSuccess('RingCentral connected successfully!');
        })
        .catch((err) => {
          const detail = err.response?.data?.detail || 'Failed to connect RingCentral. Please try again.';
          setRcError(detail);
        })
        .finally(() => setRcConnecting(false));
    }
  }, []);

  const handleConnectRC = async () => {
    setRcConnecting(true);
    setRcError('');
    try {
      const { data } = await integrationsAPI.rcAuthorize({
        redirect_uri: window.location.origin + '/profile',
      });
      if (data.authorize_url) {
        window.location.href = data.authorize_url;
      } else {
        setRcError('Invalid response from server.');
        setRcConnecting(false);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to initiate RingCentral connection.';
      setRcError(detail);
      setRcConnecting(false);
    }
  };

  const handleDisconnectRC = async () => {
    setRcDisconnecting(true);
    setRcError('');
    try {
      await integrationsAPI.rcDisconnect();
      setRcStatus({ is_connected: false, rc_email: '', rc_phone_number: '' });
      setSuccess('RingCentral disconnected.');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to disconnect RingCentral.';
      setRcError(detail);
    } finally {
      setRcDisconnecting(false);
    }
  };

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

      {/* RingCentral Connection */}
      <div className="table-container p-4 mt-4" style={{ maxWidth: '600px' }}>
        <h5 className="mb-3">
          <i className="bi bi-telephone-forward me-2"></i>RingCentral Connection
        </h5>
        {rcError && (
          <div className="alert alert-danger py-2 px-3 mb-3 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span>{rcError}</span>
            <button type="button" className="btn-close btn-close-sm ms-auto" style={{ fontSize: '0.6rem' }} onClick={() => setRcError('')}></button>
          </div>
        )}
        {rcLoading ? (
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm"></div>
          </div>
        ) : rcConnecting ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary me-2"></div>
            <span>Connecting to RingCentral...</span>
          </div>
        ) : rcStatus.is_connected ? (
          <div className="p-3 rounded-3" style={{
            background: 'rgba(48, 209, 88, 0.06)',
            border: '1px solid rgba(48, 209, 88, 0.2)',
          }}>
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-check-circle-fill" style={{ color: '#30d158', fontSize: '1.3rem' }}></i>
              <div>
                <div className="fw-bold">RingCentral Connected</div>
                <small className="text-muted">RingCentral User</small>
              </div>
            </div>
            <div className="row g-3 mb-3">
              {rcStatus.rc_email && (
                <div className="col-md-6">
                  <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.6)' }}>
                    <small className="text-muted d-block" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>EMAIL</small>
                    <span style={{ fontSize: '0.85rem' }}>{rcStatus.rc_email}</span>
                  </div>
                </div>
              )}
              {rcStatus.rc_phone_number && (
                <div className="col-md-6">
                  <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.6)' }}>
                    <small className="text-muted d-block" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>SMS NUMBER</small>
                    <span style={{ fontSize: '0.85rem' }}>{rcStatus.rc_phone_number}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                onClick={handleConnectRC} disabled={rcConnecting}>
                <i className="bi bi-arrow-repeat"></i> Reconnect
              </button>
              <button className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                onClick={handleDisconnectRC} disabled={rcDisconnecting}>
                <i className="bi bi-x-circle"></i>
                {rcDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <i className="bi bi-telephone-x" style={{ fontSize: '2rem', color: '#8e8e93' }}></i>
            <p className="text-muted mt-2 mb-3">Connect your RingCentral account to enable click-to-call features.</p>
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-2 mx-auto"
              onClick={handleConnectRC} disabled={rcConnecting}>
              <i className="bi bi-telephone-plus"></i>
              {rcConnecting ? 'Connecting...' : 'Connect RingCentral'}
            </button>
          </div>
        )}
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
