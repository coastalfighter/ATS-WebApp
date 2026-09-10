import { useState, useEffect } from 'react';
import { zoomRoomsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';

export default function ZoomRoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [testing, setTesting] = useState(null);
  const [form, setForm] = useState({ room_name: '', account_id: '', client_id: '', client_secret: '' });

  const loadRooms = async () => {
    setLoading(true);
    try {
      const { data } = await zoomRoomsAPI.list();
      setRooms(data.results || data || []);
    } catch {
      setError('Failed to load Zoom rooms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRooms(); }, []);

  const resetForm = () => {
    setForm({ room_name: '', account_id: '', client_id: '', client_secret: '' });
    setShowForm(false);
    setEditingRoom(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      if (editingRoom) {
        const payload = { ...form };
        if (!payload.client_secret) delete payload.client_secret;
        await zoomRoomsAPI.update(editingRoom.id, payload);
        setSuccess(`Room "${form.room_name}" updated.`);
      } else {
        await zoomRoomsAPI.create(form);
        setSuccess(`Room "${form.room_name}" added.`);
      }
      resetForm();
      loadRooms();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save room.');
    }
  };

  const handleEdit = (room) => {
    setForm({ room_name: room.room_name, account_id: room.account_id, client_id: room.client_id, client_secret: '' });
    setEditingRoom(room);
    setShowForm(true);
  };

  const handleToggle = async (room) => {
    try {
      await zoomRoomsAPI.toggleActive(room.id);
      loadRooms();
    } catch {
      setError('Failed to toggle room status.');
    }
  };

  const handleTest = async (room) => {
    setTesting(room.id);
    setError(''); setSuccess('');
    try {
      const { data } = await zoomRoomsAPI.testConnection(room.id);
      setSuccess(`${room.room_name}: ${data.detail}`);
    } catch (err) {
      setError(`${room.room_name}: ${err.response?.data?.detail || 'Connection test failed.'}`);
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (room) => {
    if (!confirm(`Delete room "${room.room_name}"?`)) return;
    try {
      await zoomRoomsAPI.delete(room.id);
      setSuccess(`Room "${room.room_name}" deleted.`);
      loadRooms();
    } catch {
      setError('Failed to delete room.');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>Zoom Rooms</h1>
        <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? <><i className="bi bi-x-lg"></i> Cancel</> : <><i className="bi bi-plus-lg"></i> Add Room</>}
        </button>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      {showForm && (
        <div className="table-container p-3 mb-3">
          <h6 className="mb-3">{editingRoom ? 'Edit Room' : 'Add Zoom Room'}</h6>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Room Name</label>
                <input type="text" className="form-control form-control-sm" required
                  placeholder="e.g., Interview Room 1"
                  value={form.room_name} onChange={e => setForm({ ...form, room_name: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Account ID</label>
                <input type="text" className="form-control form-control-sm" required
                  placeholder="Zoom Account ID"
                  value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Client ID</label>
                <input type="text" className="form-control form-control-sm" required
                  placeholder="OAuth App Client ID"
                  value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Client Secret {editingRoom && <small className="text-muted">(leave blank to keep existing)</small>}</label>
                <input type="password" className="form-control form-control-sm"
                  required={!editingRoom}
                  placeholder="OAuth App Client Secret"
                  value={form.client_secret} onChange={e => setForm({ ...form, client_secret: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">
                <i className="bi bi-check-lg me-1"></i> {editingRoom ? 'Update' : 'Add Room'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="row g-3">
        {rooms.length === 0 ? (
          <div className="col-12">
            <div className="table-container p-4 text-center text-muted">
              <i className="bi bi-camera-video d-block mb-2" style={{ fontSize: '2rem', opacity: 0.4 }}></i>
              No Zoom rooms configured. Add your first room to start scheduling interviews with Zoom.
            </div>
          </div>
        ) : rooms.map(room => (
          <div key={room.id} className="col-md-6 col-lg-4">
            <div className="table-container p-3 h-100">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="d-flex align-items-center gap-2">
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius)',
                    background: room.is_active ? '#2D8CFF15' : '#f1f5f9',
                    color: room.is_active ? '#2D8CFF' : '#94a3b8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className="bi bi-camera-video-fill"></i>
                  </div>
                  <div>
                    <div className="fw-medium">{room.room_name}</div>
                    <span className={`badge bg-${room.is_active ? 'success' : 'secondary'}`} style={{ fontSize: '0.65rem' }}>
                      {room.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-3 mb-3">
                <div>
                  <small className="text-muted d-block">Active Meetings</small>
                  <span className="fw-bold">{room.active_meetings || 0}</span>
                </div>
                <div>
                  <small className="text-muted d-block">Last Used</small>
                  <span style={{ fontSize: '0.82rem' }}>
                    {room.last_used_at ? new Date(room.last_used_at).toLocaleDateString() : 'Never'}
                  </span>
                </div>
              </div>

              <div className="d-flex gap-1 flex-wrap">
                <button className="btn btn-outline-primary btn-sm py-0" onClick={() => handleEdit(room)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button className={`btn btn-outline-${room.is_active ? 'warning' : 'success'} btn-sm py-0`}
                  onClick={() => handleToggle(room)}>
                  <i className={`bi bi-${room.is_active ? 'pause' : 'play'}`}></i>
                </button>
                <button className="btn btn-outline-info btn-sm py-0"
                  onClick={() => handleTest(room)} disabled={testing === room.id}>
                  {testing === room.id ? <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }}></span> : <i className="bi bi-wifi"></i>}
                </button>
                <button className="btn btn-outline-danger btn-sm py-0" onClick={() => handleDelete(room)}>
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
