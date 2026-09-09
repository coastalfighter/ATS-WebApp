import { useState, useEffect } from 'react';
import { settingsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';

export default function AdminSettingsPage() {
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
    } catch (err) {
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

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <><i className="bi bi-x-lg"></i> Cancel</> : <><i className="bi bi-plus-lg"></i> Add Setting</>}
        </button>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      {showAdd && (
        <div className="card mb-4">
          <div className="card-body">
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
        </div>
      )}

      <div className="table-container">
        <table className="table table-hover table-sm mb-0">
          <thead className="table-light">
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th style={{ width: '160px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.length === 0 ? (
              <tr><td colSpan="3" className="text-center text-muted py-4">No settings configured.</td></tr>
            ) : settings.map((s) => (
              <tr key={s.key}>
                <td className="fw-medium">{s.key}</td>
                <td>
                  {editingKey === s.key ? (
                    <input className="form-control form-control-sm" value={editValue}
                      onChange={(e) => setEditValue(e.target.value)} />
                  ) : (
                    <code>{s.value}</code>
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
    </div>
  );
}
