import { useState, useEffect } from 'react';
import { settingsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';

const INTEGRATION_GROUPS = [
  {
    key: 'zoom',
    label: 'Zoom Meeting',
    icon: 'bi-camera-video-fill',
    color: '#2D8CFF',
    description: 'Server-to-Server OAuth for automatic Zoom meeting creation',
    fields: [
      { key: 'zoom_account_id', label: 'Account ID', type: 'text', placeholder: 'Your Zoom Account ID' },
      { key: 'zoom_client_id', label: 'Client ID', type: 'text', placeholder: 'OAuth App Client ID' },
      { key: 'zoom_client_secret', label: 'Client Secret', type: 'password', placeholder: 'OAuth App Client Secret' },
      { key: 'zoom_enabled', label: 'Enable Zoom Integration', type: 'toggle' },
    ],
  },
  {
    key: 'google',
    label: 'Google Calendar',
    icon: 'bi-calendar-check-fill',
    color: '#4285F4',
    description: 'Google Calendar API for syncing interview events',
    fields: [
      { key: 'google_calendar_id', label: 'Calendar ID', type: 'text', placeholder: 'primary or calendar@group.calendar.google.com' },
      { key: 'google_service_account_email', label: 'Service Account Email', type: 'text', placeholder: 'name@project.iam.gserviceaccount.com' },
      { key: 'google_calendar_enabled', label: 'Enable Calendar Sync', type: 'toggle' },
    ],
  },
  {
    key: 'ringcentral',
    label: 'RingCentral',
    icon: 'bi-telephone-fill',
    color: '#F47721',
    description: 'Click-to-call and call tracking via RingCentral',
    fields: [
      { key: 'ringcentral_server_url', label: 'Server URL', type: 'text', placeholder: 'https://platform.ringcentral.com' },
      { key: 'ringcentral_client_id', label: 'Client ID', type: 'text', placeholder: 'OAuth App Client ID' },
      { key: 'ringcentral_client_secret', label: 'Client Secret', type: 'password', placeholder: 'OAuth App Client Secret' },
      { key: 'ringcentral_jwt_token', label: 'JWT Token', type: 'password', placeholder: 'JWT Token for auth' },
      { key: 'ringcentral_enabled', label: 'Enable RingCentral', type: 'toggle' },
    ],
  },
  {
    key: 'email',
    label: 'Email / SMTP',
    icon: 'bi-envelope-fill',
    color: '#EA4335',
    description: 'SMTP settings for sending interview invitations and reminders',
    fields: [
      { key: 'smtp_host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com' },
      { key: 'smtp_port', label: 'SMTP Port', type: 'text', placeholder: '587' },
      { key: 'smtp_username', label: 'Username', type: 'text', placeholder: 'your-email@gmail.com' },
      { key: 'smtp_password', label: 'Password', type: 'password', placeholder: 'App password' },
      { key: 'smtp_from_email', label: 'From Email', type: 'text', placeholder: 'noreply@company.com' },
      { key: 'smtp_use_tls', label: 'Use TLS', type: 'toggle' },
      { key: 'email_enabled', label: 'Enable Email Notifications', type: 'toggle' },
    ],
  },
];

function IntegrationCard({ group, settings, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const vals = {};
    group.fields.forEach(f => {
      const setting = settings.find(s => s.key === f.key);
      vals[f.key] = setting?.value || '';
    });
    setValues(vals);
  }, [settings, group]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const field of group.fields) {
        const currentSetting = settings.find(s => s.key === field.key);
        const newValue = values[field.key] || '';
        if (!currentSetting || currentSetting.value !== newValue) {
          await settingsAPI.update(field.key, { value: newValue });
        }
      }
      onUpdate(`${group.label} settings saved.`);
    } catch {
      onUpdate(null, 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = group.fields.some(f => {
    const setting = settings.find(s => s.key === f.key);
    return setting?.value && setting.value !== 'false';
  });

  return (
    <div className="table-container mb-3">
      <div className="p-3 d-flex align-items-center justify-content-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        style={{background: expanded ? 'var(--primary-bg)' : 'transparent'}}>
        <div className="d-flex align-items-center gap-3">
          <div style={{
            width:'40px', height:'40px', borderRadius:'var(--radius)',
            background: `${group.color}15`, color: group.color,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem',
          }}>
            <i className={`bi ${group.icon}`}></i>
          </div>
          <div>
            <div className="fw-medium">{group.label}</div>
            <small className="text-muted">{group.description}</small>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className={`badge bg-${isConfigured ? 'success' : 'secondary'}`} style={{fontSize:'0.68rem'}}>
            {isConfigured ? 'Configured' : 'Not configured'}
          </span>
          <i className={`bi bi-chevron-${expanded ? 'up' : 'down'} text-muted`}></i>
        </div>
      </div>
      {expanded && (
        <div className="p-3 border-top">
          <div className="row g-3">
            {group.fields.map(field => (
              <div className={field.type === 'toggle' ? 'col-md-6' : 'col-md-6'} key={field.key}>
                {field.type === 'toggle' ? (
                  <div className="form-check form-switch mt-2">
                    <input className="form-check-input" type="checkbox" role="switch"
                      checked={values[field.key] === 'true'}
                      onChange={(e) => setValues({...values, [field.key]: e.target.checked ? 'true' : 'false'})} />
                    <label className="form-check-label" style={{fontSize:'0.85rem'}}>{field.label}</label>
                  </div>
                ) : (
                  <>
                    <label className="form-label">{field.label}</label>
                    <input type={field.type} className="form-control form-control-sm"
                      placeholder={field.placeholder}
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({...values, [field.key]: e.target.value})} />
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3">
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
              onClick={handleSave} disabled={saving}>
              <i className="bi bi-check-lg"></i> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await settingsAPI.list();
      setSettings(data.results || data);
    } catch {
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSave = async (key) => {
    setError(''); setSuccess('');
    try {
      await settingsAPI.update(key, { value: editValue });
      setEditingKey(null);
      setSuccess(`Setting "${key}" updated.`);
      loadSettings();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update setting.');
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    setError(''); setSuccess('');
    try {
      await settingsAPI.update(newKey.trim(), { value: newValue });
      setNewKey('');
      setNewValue('');
      setShowAdd(false);
      setSuccess(`Setting "${newKey.trim()}" created.`);
      loadSettings();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create setting.');
    }
  };

  const handleIntegrationUpdate = (successMsg, errorMsg) => {
    if (successMsg) { setSuccess(successMsg); setError(''); }
    if (errorMsg) { setError(errorMsg); setSuccess(''); }
    loadSettings();
  };

  const integrationKeys = INTEGRATION_GROUPS.flatMap(g => g.fields.map(f => f.key));
  const generalSettings = settings.filter(s => !integrationKeys.includes(s.key));

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}>
            <i className="bi bi-gear me-1"></i> General
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'integrations' ? 'active' : ''}`}
            onClick={() => setActiveTab('integrations')}>
            <i className="bi bi-plug me-1"></i> Integrations
          </button>
        </li>
      </ul>

      {activeTab === 'general' && (
        <>
          <div className="d-flex justify-content-end mb-3">
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
              onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? <><i className="bi bi-x-lg"></i> Cancel</> : <><i className="bi bi-plus-lg"></i> Add Setting</>}
            </button>
          </div>

          {showAdd && (
            <div className="table-container p-3 mb-3">
              <h6>Add New Setting</h6>
              <form onSubmit={handleAdd}>
                <div className="row g-2">
                  <div className="col-md-4">
                    <label className="form-label">Key</label>
                    <input className="form-control form-control-sm" required
                      value={newKey} onChange={(e) => setNewKey(e.target.value)}
                      placeholder="setting_key" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Value</label>
                    <input className="form-control form-control-sm"
                      value={newValue} onChange={(e) => setNewValue(e.target.value)}
                      placeholder="setting_value" />
                  </div>
                  <div className="col-md-2 d-flex align-items-end">
                    <button type="submit" className="btn btn-primary btn-sm w-100">Save</button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="table-container">
            <table className="table table-hover table-sm mb-0">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th style={{ width: '160px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {generalSettings.length === 0 ? (
                  <tr><td colSpan="3" className="text-center text-muted py-4">No general settings configured.</td></tr>
                ) : generalSettings.map((s) => (
                  <tr key={s.key}>
                    <td className="fw-medium"><small>{s.key}</small></td>
                    <td>
                      {editingKey === s.key ? (
                        <input className="form-control form-control-sm" value={editValue}
                          onChange={(e) => setEditValue(e.target.value)} />
                      ) : (
                        <code style={{fontSize:'0.8rem'}}>{s.value}</code>
                      )}
                    </td>
                    <td>
                      {editingKey === s.key ? (
                        <div className="d-flex gap-1">
                          <button className="btn btn-primary btn-sm py-0" onClick={() => handleSave(s.key)}>Save</button>
                          <button className="btn btn-secondary btn-sm py-0" onClick={() => setEditingKey(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn btn-outline-primary btn-sm py-0"
                          onClick={() => { setEditingKey(s.key); setEditValue(s.value); }}>
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'integrations' && (
        <div>
          <p className="text-muted mb-3" style={{fontSize:'0.85rem'}}>
            Configure third-party integrations for meetings, calendar sync, and email notifications.
          </p>
          {INTEGRATION_GROUPS.map(group => (
            <IntegrationCard key={group.key} group={group} settings={settings}
              onUpdate={handleIntegrationUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
