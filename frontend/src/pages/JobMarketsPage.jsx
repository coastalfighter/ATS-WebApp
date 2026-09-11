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
  const [form, setForm] = useState({ name: '', description: '' });

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
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', description: '' });
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
    try {
      await jobMarketsAPI.toggleActive(id);
      setSuccess('Status updated.');
      fetchMarkets();
    } catch {
      setError('Failed to update status.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this job market?')) return;
    try {
      await jobMarketsAPI.delete(id);
      setSuccess('Job market deleted.');
      fetchMarkets();
    } catch {
      setError('Failed to delete.');
    }
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({ name: m.name, description: m.description || '' });
    setShowForm(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>Job Markets</h1>
        <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ name: '', description: '' }); }}>
          {showForm ? <><i className="bi bi-x-lg"></i> Cancel</> : <><i className="bi bi-plus-lg"></i> Add Job Market</>}
        </button>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h6>{editing ? `Edit: ${editing.name}` : 'New Job Market'}</h6>
            <form onSubmit={handleSubmit}>
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label">Name</label>
                  <input className="form-control form-control-sm" required
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="col-md-8">
                  <label className="form-label">Description</label>
                  <input className="form-control form-control-sm"
                    value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm mt-3">
                {editing ? 'Update' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="table table-hover table-sm mb-0">
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {markets.length === 0 ? (
              <tr><td colSpan="6" className="text-center text-muted py-4">No job markets found. Add one to get started.</td></tr>
            ) : markets.map((m) => (
              <tr key={m.id}>
                <td>{m.id}</td>
                <td className="fw-medium">{m.name}</td>
                <td><small>{m.description || '-'}</small></td>
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
                    <button className={`btn ${m.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                      onClick={() => handleToggleActive(m.id)} title={m.is_active ? 'Deactivate' : 'Activate'}>
                      <i className={`bi ${m.is_active ? 'bi-x-circle' : 'bi-check-circle'}`}></i>
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
