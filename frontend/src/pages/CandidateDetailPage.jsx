import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { candidatesAPI, interviewsAPI, usersAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { STATUS_LABELS, BUCKET_LABELS, getStatusBadgeClass, formatDate, formatDateTime } from '../utils/statusHelpers';

export default function CandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdminOrSubadmin } = useAuth();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  const [notes, setNotes] = useState([]);
  const [activity, setActivity] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [statusOptions, setStatusOptions] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [recruiters, setRecruiters] = useState([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const [interviewForm, setInterviewForm] = useState({
    interviewer_name: '', interviewer_email: '', interview_type: 'screening',
    scheduled_at: '', duration_minutes: 30, notes: '',
  });
  const [showInterviewForm, setShowInterviewForm] = useState(false);

  useEffect(() => { loadCandidate(); }, [id]);

  const loadCandidate = async () => {
    setLoading(true);
    try {
      const { data } = await candidatesAPI.get(id);
      setCandidate(data);
      setFollowUpDate(data.follow_up_date || '');
      setEditForm({
        first_name: data.first_name, last_name: data.last_name,
        email: data.email, phone: data.phone,
        alternate_phone: data.alternate_phone || '', source: data.source || '',
      });
      loadStatusOptions(data.current_bucket, data.current_status);
      loadRecruiters();
    } catch (err) {
      setError('Failed to load candidate.');
    } finally {
      setLoading(false);
    }
  };

  const loadStatusOptions = async (bucket, currentStatus) => {
    try {
      const { data } = await candidatesAPI.statusOptions({ bucket, current_status: currentStatus });
      setStatusOptions(data);
    } catch {}
  };

  const loadRecruiters = async () => {
    try {
      const { data } = await usersAPI.getRecruiters({ active_only: true });
      setRecruiters(data);
    } catch {}
  };

  const loadNotes = async () => {
    try {
      const { data } = await candidatesAPI.getNotes(id);
      setNotes(data);
    } catch {}
  };

  const loadActivity = async () => {
    try {
      const { data } = await candidatesAPI.getActivity(id);
      setActivity(data);
    } catch {}
  };

  const loadInterviews = async () => {
    try {
      const { data } = await interviewsAPI.list({ candidate: id });
      setInterviews(data.results || data);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'notes') loadNotes();
    if (activeTab === 'activity') loadActivity();
    if (activeTab === 'interviews') loadInterviews();
  }, [activeTab]);

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    setError(''); setSuccess('');
    try {
      const { data } = await candidatesAPI.updateStatus(id, {
        status: selectedStatus, remarks: statusRemarks,
        is_admin_override: isAdminOrSubadmin,
      });
      setCandidate(data);
      setSelectedStatus('');
      setStatusRemarks('');
      setSuccess('Status updated.');
      loadStatusOptions(data.current_bucket, data.current_status);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const handleReassign = async () => {
    if (!selectedRecruiter) return;
    setError(''); setSuccess('');
    try {
      const { data } = await candidatesAPI.reassign(id, { recruiter_id: parseInt(selectedRecruiter) });
      setCandidate(data);
      setSelectedRecruiter('');
      setSuccess('Candidate reassigned.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reassign.');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await candidatesAPI.addNote(id, { note: newNote });
      setNewNote('');
      loadNotes();
      setSuccess('Note added.');
    } catch (err) {
      setError('Failed to add note.');
    }
  };

  const handleFollowUp = async () => {
    setError('');
    try {
      const { data } = await candidatesAPI.setFollowUp(id, { follow_up_date: followUpDate || null });
      setCandidate(data);
      setSuccess('Follow-up date updated.');
    } catch (err) {
      setError('Failed to update follow-up date.');
    }
  };

  const handleEditSave = async () => {
    setError('');
    try {
      const { data } = await candidatesAPI.update(id, editForm);
      setCandidate(data);
      setEditing(false);
      setSuccess('Candidate updated.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update candidate.');
    }
  };

  const handleScheduleInterview = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await interviewsAPI.create({ ...interviewForm, candidate: parseInt(id) });
      setShowInterviewForm(false);
      setInterviewForm({
        interviewer_name: '', interviewer_email: '', interview_type: 'screening',
        scheduled_at: '', duration_minutes: 30, notes: '',
      });
      loadInterviews();
      setSuccess('Interview scheduled.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to schedule interview.');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!candidate) return <AlertMessage message="Candidate not found." />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{candidate.first_name} {candidate.last_name}</h1>
          <div className="d-flex gap-2 mt-1">
            <span className="badge bg-secondary">{BUCKET_LABELS[candidate.current_bucket]}</span>
            <span className={getStatusBadgeClass(candidate.current_status)}>
              {STATUS_LABELS[candidate.current_status]}
            </span>
          </div>
        </div>
        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left"></i> Back
        </button>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      <ul className="nav nav-tabs mb-3">
        {['details', 'status', 'notes', 'interviews', 'activity'].map((tab) => (
          <li key={tab} className="nav-item">
            <button
              className={`nav-link ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
          </li>
        ))}
      </ul>

      <div className="tab-content">
        {activeTab === 'details' && (
          <div className="row">
            <div className="col-md-8">
              <div className="table-container p-3">
                {editing ? (
                  <div>
                    <div className="row g-3">
                      {['first_name', 'last_name', 'email', 'phone', 'alternate_phone', 'source'].map((field) => (
                        <div className="col-md-6" key={field}>
                          <label className="form-label text-capitalize">{field.replace(/_/g, ' ')}</label>
                          <input
                            type="text" className="form-control form-control-sm"
                            value={editForm[field] || ''}
                            onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <button className="btn btn-primary btn-sm me-2" onClick={handleEditSave}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="d-flex justify-content-between mb-3">
                      <h6>Candidate Details</h6>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setEditing(true)}>Edit</button>
                    </div>
                    <table className="table table-sm">
                      <tbody>
                        <tr><td className="text-muted" style={{width:'35%'}}>Email</td><td>{candidate.email}</td></tr>
                        <tr><td className="text-muted">Phone</td><td>{candidate.phone}</td></tr>
                        <tr><td className="text-muted">Alt Phone</td><td>{candidate.alternate_phone || '-'}</td></tr>
                        <tr><td className="text-muted">Source</td><td>{candidate.source || '-'}</td></tr>
                        <tr><td className="text-muted">Recruiter</td><td>{candidate.assigned_recruiter_detail?.full_name || '-'}</td></tr>
                        <tr><td className="text-muted">Follow-up</td><td>{formatDate(candidate.follow_up_date)}</td></tr>
                        <tr><td className="text-muted">Created</td><td>{formatDateTime(candidate.created_at)}</td></tr>
                        <tr><td className="text-muted">Created By</td><td>{candidate.created_by_name || '-'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="col-md-4">
              <div className="table-container p-3 mb-3">
                <h6>Follow-up Date</h6>
                <div className="input-group input-group-sm">
                  <input type="date" className="form-control" value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)} />
                  <button className="btn btn-outline-primary" onClick={handleFollowUp}>Set</button>
                </div>
              </div>
              {isAdminOrSubadmin && (
                <div className="table-container p-3">
                  <h6>Reassign Recruiter</h6>
                  <div className="input-group input-group-sm">
                    <select className="form-select" value={selectedRecruiter}
                      onChange={(e) => setSelectedRecruiter(e.target.value)}>
                      <option value="">Select recruiter</option>
                      {recruiters.map((r) => (
                        <option key={r.id} value={r.id}>{r.full_name || `${r.first_name} ${r.last_name}`}</option>
                      ))}
                    </select>
                    <button className="btn btn-outline-primary" onClick={handleReassign}>Reassign</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="row">
            <div className="col-md-6">
              <div className="table-container p-3">
                <h6>Update Status</h6>
                <p className="text-muted small">
                  Current: <span className={getStatusBadgeClass(candidate.current_status)}>
                    {STATUS_LABELS[candidate.current_status]}
                  </span>
                </p>
                <div className="mb-3">
                  <select className="form-select form-select-sm" value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}>
                    <option value="">Select new status</option>
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <textarea className="form-control form-control-sm" rows="2"
                    placeholder="Remarks (optional)" value={statusRemarks}
                    onChange={(e) => setStatusRemarks(e.target.value)} />
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleStatusUpdate}
                  disabled={!selectedStatus}>Update Status</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            <div className="table-container p-3 mb-3">
              <h6>Add Note</h6>
              <div className="input-group">
                <textarea className="form-control form-control-sm" rows="2"
                  value={newNote} onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Type a note..." />
                <button className="btn btn-primary btn-sm" onClick={handleAddNote}>Add</button>
              </div>
            </div>
            <div className="table-container">
              <table className="table table-sm">
                <thead><tr><th>Note</th><th>By</th><th>Date</th></tr></thead>
                <tbody>
                  {notes.length === 0 ? (
                    <tr><td colSpan="3" className="text-center text-muted py-3">No notes yet.</td></tr>
                  ) : notes.map((n) => (
                    <tr key={n.id}>
                      <td>{n.note}</td>
                      <td>{n.created_by_name || '-'}</td>
                      <td>{formatDateTime(n.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'interviews' && (
          <div>
            <div className="d-flex justify-content-between mb-3">
              <h6>Interviews</h6>
              <button className="btn btn-primary btn-sm" onClick={() => setShowInterviewForm(!showInterviewForm)}>
                {showInterviewForm ? 'Cancel' : 'Schedule Interview'}
              </button>
            </div>
            {showInterviewForm && (
              <div className="table-container p-3 mb-3">
                <form onSubmit={handleScheduleInterview}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Interviewer Name</label>
                      <input type="text" className="form-control form-control-sm" required
                        value={interviewForm.interviewer_name}
                        onChange={(e) => setInterviewForm({...interviewForm, interviewer_name: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Interviewer Email</label>
                      <input type="email" className="form-control form-control-sm" required
                        value={interviewForm.interviewer_email}
                        onChange={(e) => setInterviewForm({...interviewForm, interviewer_email: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Type</label>
                      <select className="form-select form-select-sm"
                        value={interviewForm.interview_type}
                        onChange={(e) => setInterviewForm({...interviewForm, interview_type: e.target.value})}>
                        <option value="screening">Screening</option>
                        <option value="technical">Technical</option>
                        <option value="hr">HR</option>
                        <option value="final">Final</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Date & Time</label>
                      <input type="datetime-local" className="form-control form-control-sm" required
                        value={interviewForm.scheduled_at}
                        onChange={(e) => setInterviewForm({...interviewForm, scheduled_at: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Duration (min)</label>
                      <input type="number" className="form-control form-control-sm"
                        value={interviewForm.duration_minutes}
                        onChange={(e) => setInterviewForm({...interviewForm, duration_minutes: parseInt(e.target.value)})} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Notes</label>
                      <textarea className="form-control form-control-sm" rows="2"
                        value={interviewForm.notes}
                        onChange={(e) => setInterviewForm({...interviewForm, notes: e.target.value})} />
                    </div>
                    <div className="col-12">
                      <button type="submit" className="btn btn-primary btn-sm">Schedule</button>
                    </div>
                  </div>
                </form>
              </div>
            )}
            <div className="table-container">
              <table className="table table-sm">
                <thead><tr><th>Type</th><th>Interviewer</th><th>Scheduled</th><th>Duration</th><th>Status</th><th>Zoom</th></tr></thead>
                <tbody>
                  {(Array.isArray(interviews) ? interviews : []).length === 0 ? (
                    <tr><td colSpan="6" className="text-center text-muted py-3">No interviews scheduled.</td></tr>
                  ) : (Array.isArray(interviews) ? interviews : []).map((iv) => (
                    <tr key={iv.id}>
                      <td className="text-capitalize">{iv.interview_type}</td>
                      <td>{iv.interviewer_name}</td>
                      <td>{formatDateTime(iv.scheduled_at)}</td>
                      <td>{iv.duration_minutes} min</td>
                      <td><span className={`badge bg-${iv.status === 'scheduled' ? 'primary' : iv.status === 'completed' ? 'success' : 'danger'}`}>{iv.status}</span></td>
                      <td>{iv.zoom_join_url ? <a href={iv.zoom_join_url} target="_blank" rel="noreferrer">Join</a> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="table-container">
            <table className="table table-sm">
              <thead><tr><th>Action</th><th>Old Value</th><th>New Value</th><th>Remarks</th><th>By</th><th>Time</th></tr></thead>
              <tbody>
                {activity.length === 0 ? (
                  <tr><td colSpan="6" className="text-center text-muted py-3">No activity yet.</td></tr>
                ) : activity.map((log) => (
                  <tr key={log.id}>
                    <td>{log.action_type.replace(/_/g, ' ')}</td>
                    <td>{log.old_value || '-'}</td>
                    <td>{log.new_value || '-'}</td>
                    <td>{log.remarks || '-'}</td>
                    <td>{log.performed_by_name || '-'}</td>
                    <td>{formatDateTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
