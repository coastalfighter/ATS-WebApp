import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { formatDate } from '../utils/statusHelpers';

export default function HiringManagersPage() {
  const { isAdmin } = useAuth();
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    phone: '', password: '', password_confirm: '',
  });
  const [editForm, setEditForm] = useState({});

  const fetchManagers = async () => {
    setLoading(true);
    try {
      const { data } = await usersAPI.getHiringManagers();
      setManagers(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError('Failed to load hiring managers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchManagers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await usersAPI.create({ ...form, role: 'hiring_manager' });
      setSuccess('Hiring manager created.');
      setShowForm(false);
      setForm({ username: '', email: '', first_name: '', last_name: '', phone: '', password: '', password_confirm: '' });
      fetchManagers();
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setError(msgs.join(' | '));
      } else {
        setError('Failed to create hiring manager.');
      }
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await usersAPI.toggleActive(id);
      setSuccess('Status updated.');
      fetchManagers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const openEdit = (u) => {
    setEditing(u);
    setEditForm({
      first_name: u.first_name || '', last_name: u.last_name || '',
      email: u.email || '', phone: u.phone || '',
    });
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setError(''); setSuccess('');
    try {
      await usersAPI.update(editing.id, editForm);
      setSuccess(`Hiring manager "${editing.username}" updated.`);
      setEditing(null);
      fetchManagers();
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setError(msgs.join(' | '));
      } else {
        setError('Failed to update.');
      }
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>Hiring Managers</h1>
        <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => { setShowForm(!showForm); setEditing(null); }}>
          {showForm ? <><i className="bi bi-x-lg"></i> Cancel</> : <><i className="bi bi-person-plus"></i> Add Hiring Manager</>}
        </button>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h6>New Hiring Manager</h6>
            <form onSubmit={handleCreate}>
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label">Username</label>
                  <input className="form-control form-control-sm" required
                    value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control form-control-sm" required
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Phone</label>
                  <input className="form-control form-control-sm"
                    value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">First Name</label>
                  <input className="form-control form-control-sm" required
                    value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Last Name</label>
                  <input className="form-control form-control-sm" required
                    value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-control form-control-sm" required
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Confirm Password</label>
                  <input type="password" className="form-control form-control-sm" required
                    value={form.password_confirm} onChange={(e) => setForm({ ...form, password_confirm: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm mt-3">Create</button>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">Edit: {editing.username}</h6>
              <button className="btn-close" onClick={() => setEditing(null)}></button>
            </div>
            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label">First Name</label>
                <input className="form-control form-control-sm" value={editForm.first_name}
                  onChange={(e) => setEditForm({...editForm, first_name: e.target.value})} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Last Name</label>
                <input className="form-control form-control-sm" value={editForm.last_name}
                  onChange={(e) => setEditForm({...editForm, last_name: e.target.value})} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Email</label>
                <input type="email" className="form-control form-control-sm" value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Phone</label>
                <input className="form-control form-control-sm" value={editForm.phone}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <div className="d-flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={handleEditSave}>Save</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="table table-hover table-sm mb-0">
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {managers.length === 0 ? (
              <tr><td colSpan="8" className="text-center text-muted py-4">No hiring managers found. Add one to get started.</td></tr>
            ) : managers.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.full_name || `${u.first_name} ${u.last_name}`}</td>
                <td><small>{u.email}</small></td>
                <td><small>{u.phone || '-'}</small></td>
                <td>
                  <span className={`badge ${u.is_active ? 'bg-success' : 'bg-danger'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td><small>{formatDate(u.created_at)}</small></td>
                <td>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-primary" title="Edit"
                      onClick={() => { openEdit(u); setShowForm(false); }}>
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button className={`btn ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                      onClick={() => handleToggleActive(u.id)} title={u.is_active ? 'Deactivate' : 'Activate'}>
                      <i className={`bi ${u.is_active ? 'bi-person-x' : 'bi-person-check'}`}></i>
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
