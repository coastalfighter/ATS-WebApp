import { useState, useEffect } from 'react';
import { settingsAPI, emailTemplatesAPI, usersAPI } from '../services/api';
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
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}>
            <i className="bi bi-envelope-paper me-1"></i> Email Templates
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'kpi' ? 'active' : ''}`}
            onClick={() => setActiveTab('kpi')}>
            <i className="bi bi-bullseye me-1"></i> KPI Settings
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

      {activeTab === 'templates' && (
        <EmailTemplatesTab onSuccess={(msg) => { setSuccess(msg); setError(''); }}
          onError={(msg) => { setError(msg); setSuccess(''); }} />
      )}

      {activeTab === 'kpi' && (
        <KPISettingsTab settings={settings} onUpdate={handleIntegrationUpdate} />
      )}
    </div>
  );
}

function EmailTemplatesTab({ onSuccess, onError }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editForm, setEditForm] = useState({ subject_template: '', body_template: '' });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    emailTemplatesAPI.list()
      .then(({ data }) => setTemplates(data.results || data))
      .catch(() => onError('Failed to load email templates.'))
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = (tpl) => {
    setEditingKey(tpl.template_key);
    setEditForm({ subject_template: tpl.subject_template, body_template: tpl.body_template });
    setPreview(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await emailTemplatesAPI.update(editingKey, editForm);
      setTemplates(prev => prev.map(t =>
        t.template_key === editingKey ? { ...t, ...editForm } : t
      ));
      setEditingKey(null);
      onSuccess('Template updated.');
    } catch {
      onError('Failed to update template.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (key) => {
    try {
      const { data } = await emailTemplatesAPI.preview(key);
      setPreview(data);
    } catch {
      onError('Failed to preview template.');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <p className="text-muted mb-3" style={{fontSize:'0.85rem'}}>
        Customize email templates sent for interview events. Use <code>{'{variable_name}'}</code> for dynamic content.
      </p>
      <div className="mb-2" style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>
        Available variables: <code>candidate_name</code>, <code>interviewer_name</code>,
        <code> interview_type</code>, <code>scheduled_at</code>, <code>duration</code>, <code>zoom_info</code>
      </div>

      {templates.map(tpl => (
        <div key={tpl.template_key} className="table-container mb-3">
          <div className="p-3 d-flex align-items-center justify-content-between"
            style={{borderBottom: editingKey === tpl.template_key ? '1px solid var(--border)' : 'none'}}>
            <div>
              <div className="fw-medium">{tpl.label}</div>
              <small className="text-muted"><code>{tpl.template_key}</code></small>
            </div>
            <div className="d-flex gap-2">
              {editingKey !== tpl.template_key && (
                <>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => handlePreview(tpl.template_key)}>
                    <i className="bi bi-eye me-1"></i>Preview
                  </button>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => handleEdit(tpl)}>
                    <i className="bi bi-pencil me-1"></i>Edit
                  </button>
                </>
              )}
            </div>
          </div>

          {editingKey === tpl.template_key && (
            <div className="p-3">
              <div className="mb-3">
                <label className="form-label">Subject</label>
                <input className="form-control form-control-sm" value={editForm.subject_template}
                  onChange={(e) => setEditForm({ ...editForm, subject_template: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="form-label">Body</label>
                <textarea className="form-control form-control-sm" rows={8} value={editForm.body_template}
                  onChange={(e) => setEditForm({ ...editForm, body_template: e.target.value })} />
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                  <i className="bi bi-check-lg me-1"></i>{saving ? 'Saving...' : 'Save'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingKey(null)}>Cancel</button>
              </div>
            </div>
          )}

          {preview && editingKey !== tpl.template_key && (
            <div className="p-3 border-top" style={{background:'#f8fafc'}}>
              <div className="mb-2"><strong>Subject:</strong> {preview.subject}</div>
              <pre style={{fontSize:'0.8rem', whiteSpace:'pre-wrap', margin:0}}>{preview.body}</pre>
              <button className="btn btn-sm btn-link p-0 mt-2" onClick={() => setPreview(null)}>Close preview</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function KPISettingsTab({ settings, onUpdate }) {
  const [globalCallTarget, setGlobalCallTarget] = useState('');
  const [globalBookingTarget, setGlobalBookingTarget] = useState('');
  const [recruiters, setRecruiters] = useState([]);
  const [recruiterTargets, setRecruiterTargets] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const callSetting = settings.find(s => s.key === 'default_daily_call_target');
    const bookingSetting = settings.find(s => s.key === 'default_daily_booking_target');
    setGlobalCallTarget(callSetting?.value || '0');
    setGlobalBookingTarget(bookingSetting?.value || '0');
    usersAPI.getRecruiters({ active_only: true })
      .then(({ data }) => {
        const recs = Array.isArray(data) ? data : data.results || [];
        setRecruiters(recs);
        const targets = {};
        recs.forEach(r => {
          targets[r.id] = {
            daily_call_target: r.daily_call_target || 0,
            daily_booking_target: r.daily_booking_target || 0,
          };
        });
        setRecruiterTargets(targets);
      })
      .catch(() => {});
  }, [settings]);

  const handleSaveGlobal = async () => {
    setSaving(true);
    try {
      await settingsAPI.update('default_daily_call_target', { value: globalCallTarget });
      await settingsAPI.update('default_daily_booking_target', { value: globalBookingTarget });
      onUpdate('Global KPI targets saved.');
    } catch {
      onUpdate(null, 'Failed to save global targets.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRecruiter = async (recruiterId) => {
    const targets = recruiterTargets[recruiterId];
    if (!targets) return;
    try {
      await usersAPI.update(recruiterId, {
        daily_call_target: parseInt(targets.daily_call_target) || 0,
        daily_booking_target: parseInt(targets.daily_booking_target) || 0,
      });
      onUpdate('Recruiter KPI targets saved.');
    } catch {
      onUpdate(null, 'Failed to save recruiter targets.');
    }
  };

  return (
    <div>
      <div className="table-container p-3 mb-4">
        <h6 className="mb-3">
          <i className="bi bi-globe me-2"></i>Global Default Targets
        </h6>
        <p className="text-muted mb-3" style={{fontSize:'0.85rem'}}>
          These targets apply to all recruiters who don't have individual targets set.
        </p>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label">Daily Call Target</label>
            <input type="number" className="form-control form-control-sm" min="0"
              value={globalCallTarget} onChange={(e) => setGlobalCallTarget(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Daily Booking Target</label>
            <input type="number" className="form-control form-control-sm" min="0"
              value={globalBookingTarget} onChange={(e) => setGlobalBookingTarget(e.target.value)} />
          </div>
          <div className="col-md-4 d-flex align-items-end">
            <button className="btn btn-primary btn-sm" onClick={handleSaveGlobal} disabled={saving}>
              <i className="bi bi-check-lg me-1"></i>{saving ? 'Saving...' : 'Save Global Targets'}
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="p-3 border-bottom d-flex align-items-center gap-2">
          <i className="bi bi-person-badge" style={{ color: 'var(--primary)' }}></i>
          <h6 className="mb-0">Per-Recruiter Targets</h6>
        </div>
        <table className="table table-sm table-hover mb-0">
          <thead>
            <tr>
              <th>Recruiter</th>
              <th style={{width:'140px'}}>Call Target</th>
              <th style={{width:'140px'}}>Booking Target</th>
              <th style={{width:'80px'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recruiters.map((r) => (
              <tr key={r.id}>
                <td className="fw-medium">{r.full_name || `${r.first_name} ${r.last_name}`}</td>
                <td>
                  <input type="number" className="form-control form-control-sm" min="0"
                    value={recruiterTargets[r.id]?.daily_call_target || 0}
                    onChange={(e) => setRecruiterTargets({
                      ...recruiterTargets,
                      [r.id]: { ...recruiterTargets[r.id], daily_call_target: e.target.value }
                    })} />
                </td>
                <td>
                  <input type="number" className="form-control form-control-sm" min="0"
                    value={recruiterTargets[r.id]?.daily_booking_target || 0}
                    onChange={(e) => setRecruiterTargets({
                      ...recruiterTargets,
                      [r.id]: { ...recruiterTargets[r.id], daily_booking_target: e.target.value }
                    })} />
                </td>
                <td>
                  <button className="btn btn-outline-primary btn-sm py-0" onClick={() => handleSaveRecruiter(r.id)}>
                    <i className="bi bi-check-lg"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
