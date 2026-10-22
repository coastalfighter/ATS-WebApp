import { useState, useEffect } from 'react';
import { jobMarketsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { formatDate } from '../utils/statusHelpers';

export default function JobMarketsPage() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const { data } = await jobMarketsAPI.list();
      setMarkets(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Failed to load job markets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMarkets(); }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', is_active: true });
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      if (editing) {
        await jobMarketsAPI.update(editing.id, form);
        setSuccess('Job market updated.');
      } else {
        await jobMarketsAPI.create(form);
        setSuccess('Job market created.');
      }
      resetForm();
      fetchMarkets();
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setError(msgs.join(' | '));
      } else {
        setError('Operation failed.');
      }
    }
  };

  const handleToggleActive = async (id) => {
    setError(''); setSuccess('');
    try {
      await jobMarketsAPI.toggleActive(id);
      setSuccess('Status updated.');
      fetchMarkets();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this job market?')) return;
    setError(''); setSuccess('');
    try {
      await jobMarketsAPI.delete(id);
      setSuccess('Job market deleted.');
      fetchMarkets();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete.');
    }
  };

  const openEdit = (market) => {
    setEditing(market);
    setForm({
      name: market.name,
      description: market.description || '',
      is_active: market.is_active,
    });
    setShowForm(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>Job Markets</h1>
        <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? <><i className="bi bi-x-lg"></i> Cancel</> : <><i className="bi bi-plus-lg"></i> Add Job Market</>}
        </button>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      {showForm && (
        <div className="table-container p-3 mb-3">
          <h6 className="mb-3">{editing ? `Edit: ${editing.name}` : 'New Job Market'}</h6>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-5">
                <label className="form-label">Name</label>
                <input className="form-control form-control-sm" required
                  placeholder="e.g., Dallas, TX"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-5">
                <label className="form-label">Description</label>
                <input className="form-control form-control-sm"
                  placeholder="Optional description"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <select className="form-select form-select-sm"
                  value={form.is_active ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">
                <i className="bi bi-check-lg me-1"></i> {editing ? 'Update' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table className="table table-hover table-sm mb-0">
          <thead className="table-light">
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Created</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {markets.length === 0 ? (
              <tr><td colSpan="5" className="text-center text-muted py-4">
                <i className="bi bi-geo-alt d-block mb-2" style={{ fontSize: '1.5rem', opacity: 0.4 }}></i>
                No job markets found. Add one to get started.
              </td></tr>
            ) : markets.map((m) => (
              <tr key={m.id}>
                <td className="fw-medium">{m.name}</td>
                <td><small className="text-muted">{m.description || '-'}</small></td>
                <td>
                  <span className={`badge ${m.is_active ? 'bg-success' : 'bg-danger'}`}>
                    {m.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td><small>{formatDate(m.created_at)}</small></td>
                <td>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-primary" title="Edit" onClick={() => openEdit(m)}>
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button className={`btn ${m.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                      onClick={() => handleToggleActive(m.id)}
                      title={m.is_active ? 'Deactivate' : 'Activate'}>
                      <i className={`bi ${m.is_active ? 'bi-pause' : 'bi-play'}`}></i>
                    </button>
                    <button className="btn btn-outline-danger" title="Delete" onClick={() => handleDelete(m.id)}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
