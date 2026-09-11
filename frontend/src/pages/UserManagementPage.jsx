import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { formatDate } from '../utils/statusHelpers';

export default function UserManagementPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [resetPasswordData, setResetPasswordData] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    role: 'recruiter', phone: '', password: '', password_confirm: '',
    daily_call_target: 0, daily_booking_target: 0,
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (roleFilter) params.role = roleFilter;
      const res = await usersAPI.list(params);
      setUsers(res.data.results || res.data);
    } catch (err) {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [roleFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await usersAPI.create(form);
      setSuccess('User created successfully.');
      setShowCreateForm(false);
      setForm({
        username: '', email: '', first_name: '', last_name: '',
        role: 'recruiter', phone: '', password: '', password_confirm: '',
        daily_call_target: 0, daily_booking_target: 0,
      });
      fetchUsers();
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setError(msgs.join(' | '));
      } else {
        setError('Failed to create user.');
      }
    }
  };

  const handleToggleActive = async (userId) => {
    try {
      await usersAPI.toggleActive(userId);
      setSuccess('User status updated.');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordData || !newPassword) return;
    try {
      await usersAPI.resetPassword({
        user_id: resetPasswordData.id,
        new_password: newPassword,
      });
      setSuccess(`Password reset for ${resetPasswordData.username}.`);
      setResetPasswordData(null);
      setNewPassword('');
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setError(msgs.join(' | '));
      } else {
        setError('Failed to reset password.');
      }
    }
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setEditForm({
      first_name: u.first_name || '', last_name: u.last_name || '',
      email: u.email || '', phone: u.phone || '', role: u.role,
      daily_call_target: u.daily_call_target || 0,
      daily_booking_target: u.daily_booking_target || 0,
    });
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    setError(''); setSuccess('');
    try {
      await usersAPI.update(editingUser.id, editForm);
      setSuccess(`User "${editingUser.username}" updated.`);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setError(msgs.join(' | '));
      } else {
        setError('Failed to update user.');
      }
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => { setShowCreateForm(!showCreateForm); setEditingUser(null); }}>
          {showCreateForm ? (
            <><i className="bi bi-x-lg"></i> Cancel</>
          ) : (
            <><i className="bi bi-person-plus"></i> Create User</>
          )}
        </button>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      {showCreateForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h6>Create New User</h6>
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
                  <label className="form-label">Role</label>
                  <select className="form-select form-select-sm"
                    value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="recruiter">Recruiter</option>
                    <option value="subadmin">Subadmin</option>
                    {isAdmin && <option value="admin">Admin</option>}
                  </select>
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
                  <label className="form-label">Phone</label>
                  <input className="form-control form-control-sm"
                    value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
                <div className="col-md-4">
                  <label className="form-label">Daily Call Target</label>
                  <input type="number" className="form-control form-control-sm" min="0"
                    value={form.daily_call_target} onChange={(e) => setForm({ ...form, daily_call_target: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Daily Booking Target</label>
                  <input type="number" className="form-control form-control-sm" min="0"
                    value={form.daily_booking_target} onChange={(e) => setForm({ ...form, daily_booking_target: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm mt-3">Create User</button>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">Edit User: {editingUser.username}</h6>
              <button className="btn-close" onClick={() => setEditingUser(null)}></button>
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
              <div className="col-md-3">
                <label className="form-label">Role</label>
                <select className="form-select form-select-sm" value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}>
                  <option value="recruiter">Recruiter</option>
                  <option value="subadmin">Subadmin</option>
                  {isAdmin && <option value="admin">Admin</option>}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Daily Call Target</label>
                <input type="number" className="form-control form-control-sm" min="0"
                  value={editForm.daily_call_target}
                  onChange={(e) => setEditForm({...editForm, daily_call_target: parseInt(e.target.value) || 0})} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Daily Booking Target</label>
                <input type="number" className="form-control form-control-sm" min="0"
                  value={editForm.daily_booking_target}
                  onChange={(e) => setEditForm({...editForm, daily_booking_target: parseInt(e.target.value) || 0})} />
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <div className="d-flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={handleEditSave}>Save</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetPasswordData && (
        <div className="card mb-4">
          <div className="card-body">
            <h6>Reset Password for: {resetPasswordData.username}</h6>
            <div className="row g-2">
              <div className="col-md-4">
                <input type="password" className="form-control form-control-sm"
                  placeholder="New password"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="col-md-4">
                <button className="btn btn-warning btn-sm me-2" onClick={handleResetPassword}>Reset</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setResetPasswordData(null); setNewPassword(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <select className="form-select form-select-sm" style={{ width: '180px' }}
          value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="subadmin">Subadmin</option>
          <option value="recruiter">Recruiter</option>
        </select>
      </div>

      <div className="table-container">
        <table className="table table-hover table-sm mb-0">
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.full_name || `${u.first_name} ${u.last_name}`}</td>
                <td><small>{u.email}</small></td>
                <td><small>{u.phone || '-'}</small></td>
                <td><span className="badge bg-secondary">{u.role}</span></td>
                <td>
                  <span className={`badge ${u.is_active ? 'bg-success' : 'bg-danger'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td><small>{formatDate(u.created_at)}</small></td>
                <td>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-primary" title="Edit"
                      onClick={() => { openEdit(u); setShowCreateForm(false); }}>
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button className={`btn ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                      onClick={() => handleToggleActive(u.id)} title={u.is_active ? 'Deactivate' : 'Activate'}>
                      <i className={`bi ${u.is_active ? 'bi-person-x' : 'bi-person-check'}`}></i>
                    </button>
                    {isAdmin && (
                      <button className="btn btn-outline-warning" title="Reset Password"
                        onClick={() => setResetPasswordData(u)}>
                        <i className="bi bi-key"></i>
                      </button>
                    )}
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
