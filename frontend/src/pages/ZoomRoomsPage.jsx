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
  const [form, setForm] = useState({
    room_number: '', room_name: '', zoom_email: '',
    personal_meeting_link: '', is_active: true, notes: '',
  });

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
    setForm({
      room_number: '', room_name: '', zoom_email: '',
      personal_meeting_link: '', is_active: true, notes: '',
    });
    setShowForm(false);
    setEditingRoom(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const payload = { ...form, room_number: parseInt(form.room_number) || 1 };
      if (editingRoom) {
        await zoomRoomsAPI.update(editingRoom.id, payload);
        setSuccess(`Room "${form.room_name}" updated.`);
      } else {
        await zoomRoomsAPI.create(payload);
        setSuccess(`Room "${form.room_name}" added.`);
      }
      resetForm();
      loadRooms();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setError(msgs.join(' | '));
      } else {
        setError('Failed to save room.');
      }
    }
  };

  const handleEdit = (room) => {
    setForm({
      room_number: room.room_number || '',
      room_name: room.room_name,
      zoom_email: room.zoom_email || '',
      personal_meeting_link: room.personal_meeting_link || '',
      is_active: room.is_active,
      notes: room.notes || '',
    });
    setEditingRoom(room);
    setShowForm(true);
  };

  const handleToggle = async (room) => {
    setError(''); setSuccess('');
    try {
      await zoomRoomsAPI.toggleActive(room.id);
      setSuccess(`${room.room_name} status updated.`);
      loadRooms();
    } catch {
      setError('Failed to toggle room status.');
    }
  };

  const handleDelete = async (room) => {
    if (!confirm(`Delete room "${room.room_name}"?`)) return;
    setError(''); setSuccess('');
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

      <div className="alert alert-info py-2 mb-3" style={{ fontSize: '0.85rem' }}>
        <i className="bi bi-info-circle me-2"></i>
        Use Basic Zoom personal meeting links. ATS will assign one free room per overlapping slot.
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      {showForm && (
        <div className="table-container p-3 mb-3">
          <h6 className="mb-3">{editingRoom ? `Edit: ${editingRoom.room_name}` : 'Add Zoom Room'}</h6>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Room No.</label>
                <input type="number" className="form-control form-control-sm" required min="1"
                  placeholder="e.g., 1"
                  value={form.room_number} onChange={e => setForm({ ...form, room_number: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Room Name</label>
                <input type="text" className="form-control form-control-sm" required
                  placeholder="e.g., Zoom Room 1"
                  value={form.room_name} onChange={e => setForm({ ...form, room_name: e.target.value })} />
              </div>
              <div className="col-md-5">
                <label className="form-label">Zoom Email</label>
                <input type="email" className="form-control form-control-sm"
                  placeholder="e.g., admin@company.com"
                  value={form.zoom_email} onChange={e => setForm({ ...form, zoom_email: e.target.value })} />
              </div>
              <div className="col-md-8">
                <label className="form-label">Personal Meeting Link</label>
                <input type="url" className="form-control form-control-sm" required
                  placeholder="https://zoom.us/j/1234567890"
                  value={form.personal_meeting_link} onChange={e => setForm({ ...form, personal_meeting_link: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Status</label>
                <select className="form-select form-select-sm"
                  value={form.is_active ? 'true' : 'false'}
                  onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Notes</label>
                <input type="text" className="form-control form-control-sm"
                  placeholder="e.g., Basic Zoom personal room"
                  value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">
                <i className="bi bi-check-lg me-1"></i> {editingRoom ? 'Update Room' : 'Add Room'}
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
              <th style={{ width: '60px' }}>Room</th>
              <th>Name</th>
              <th>Email</th>
              <th>Meeting Link</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Active</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 ? (
              <tr><td colSpan="8" className="text-center text-muted py-4">
                <i className="bi bi-camera-video d-block mb-2" style={{ fontSize: '1.5rem', opacity: 0.4 }}></i>
                No Zoom rooms configured. Add your first room to start.
              </td></tr>
            ) : rooms.map(room => (
              <tr key={room.id}>
                <td>
                  <span className="badge bg-primary">{room.room_number || '-'}</span>
                </td>
                <td className="fw-medium">{room.room_name}</td>
                <td><small>{room.zoom_email || '-'}</small></td>
                <td>
                  {room.personal_meeting_link ? (
                    <a href={room.personal_meeting_link} target="_blank" rel="noreferrer"
                      style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>
                      {room.personal_meeting_link}
                    </a>
                  ) : '-'}
                </td>
                <td>
                  <span className={`badge bg-${room.is_active ? 'success' : 'danger'}`}>
                    {room.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td><small className="text-muted">{room.notes || '-'}</small></td>
                <td><small>{room.active_meetings || 0} meetings</small></td>
                <td>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-primary" title="Edit" onClick={() => handleEdit(room)}>
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button className={`btn btn-outline-${room.is_active ? 'warning' : 'success'}`}
                      title={room.is_active ? 'Deactivate' : 'Activate'}
                      onClick={() => handleToggle(room)}>
                      <i className={`bi bi-${room.is_active ? 'pause' : 'play'}`}></i>
                    </button>
                    <button className="btn btn-outline-danger" title="Delete" onClick={() => handleDelete(room)}>
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
