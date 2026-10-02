import { useState, useEffect } from 'react';
import { locationsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { formatDate } from '../utils/statusHelpers';

export default function JobMarketsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', address: '', city: '', state: '', country: 'USA',
    latitude: '', longitude: '',
  });

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const { data } = await locationsAPI.list();
      setLocations(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Failed to load job markets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLocations(); }, []);

  const resetForm = () => {
    setForm({ name: '', address: '', city: '', state: '', country: 'USA', latitude: '', longitude: '' });
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      if (editing) {
        await locationsAPI.update(editing.id, form);
        setSuccess('Job market updated.');
      } else {
        await locationsAPI.create(form);
        setSuccess('Job market created.');
      }
      resetForm();
      fetchLocations();
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
      await locationsAPI.toggleActive(id);
      setSuccess('Status updated.');
      fetchLocations();
    } catch {
      setError('Failed to update status.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this job market?')) return;
    try {
      await locationsAPI.delete(id);
      setSuccess('Job market deleted.');
      fetchLocations();
    } catch {
      setError('Failed to delete.');
    }
  };

  const openEdit = (loc) => {
    setEditing(loc);
    setForm({
      name: loc.name,
      address: loc.address || '',
      city: loc.city || '',
      state: loc.state || '',
      country: loc.country || 'USA',
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
    setShowForm(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>Job Markets</h1>
        <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => { setShowForm(!showForm); setEditing(null); resetForm(); if (!showForm) setShowForm(true); }}>
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
                    placeholder="e.g., Dallas, TX"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Address</label>
                  <input className="form-control form-control-sm" required
                    placeholder="Full address"
                    value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">City</label>
                  <input className="form-control form-control-sm"
                    value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">State</label>
                  <input className="form-control form-control-sm"
                    value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Country</label>
                  <input className="form-control form-control-sm"
                    value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Latitude</label>
                  <input type="number" step="any" className="form-control form-control-sm" required
                    placeholder="e.g., 32.7767"
                    value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Longitude</label>
                  <input type="number" step="any" className="form-control form-control-sm" required
                    placeholder="e.g., -96.7970"
                    value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                </div>
              </div>
              <div className="mt-3 d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm">
                  {editing ? 'Update' : 'Create'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={resetForm}>Cancel</button>
              </div>
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
              <th>City</th>
              <th>State</th>
              <th>Status</th>
              <th>Interviews</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr><td colSpan="8" className="text-center text-muted py-4">No job markets found. Add one to get started.</td></tr>
            ) : locations.map((loc) => (
              <tr key={loc.id}>
                <td>{loc.id}</td>
                <td className="fw-medium">{loc.name}</td>
                <td><small>{loc.city || '-'}</small></td>
                <td><small>{loc.state || '-'}</small></td>
                <td>
                  <span className={`badge ${loc.is_active ? 'bg-success' : 'bg-danger'}`}>
                    {loc.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td><small>{loc.interview_count || 0}</small></td>
                <td><small>{formatDate(loc.created_at)}</small></td>
                <td>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-primary" title="Edit" onClick={() => openEdit(loc)}>
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button className={`btn ${loc.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                      onClick={() => handleToggleActive(loc.id)} title={loc.is_active ? 'Deactivate' : 'Activate'}>
                      <i className={`bi ${loc.is_active ? 'bi-x-circle' : 'bi-check-circle'}`}></i>
                    </button>
                    <button className="btn btn-outline-danger" title="Delete" onClick={() => handleDelete(loc.id)}>
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
