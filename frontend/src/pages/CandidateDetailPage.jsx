import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { candidatesAPI, interviewsAPI, usersAPI, bookingsAPI } from '../services/api';
import BookCandidateModal from '../components/bookings/BookCandidateModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { STATUS_LABELS, BUCKET_LABELS, getStatusBadgeClass, formatDate, formatDateTime } from '../utils/statusHelpers';

const LIFECYCLE_ACTIONS = {
  never_contacted: [
    { status: 'contacted', label: 'Mark Contacted', icon: 'bi-telephone-fill', color: 'primary' },
    { status: 'unanswered', label: 'Mark Unanswered', icon: 'bi-telephone-x', color: 'warning' },
    { status: 'wrong_number', label: 'Wrong Number', icon: 'bi-x-circle', color: 'danger' },
  ],
  contacted: [
    { status: 'interested', label: 'Mark Interested', icon: 'bi-hand-thumbs-up-fill', color: 'success' },
    { status: 'not_interested', label: 'Not Interested', icon: 'bi-hand-thumbs-down', color: 'danger' },
    { status: 'asked_to_connect_later', label: 'Connect Later', icon: 'bi-clock', color: 'warning' },
    { status: 'follow_up_due', label: 'Set Follow-up', icon: 'bi-calendar-check', color: 'info' },
  ],
  unanswered: [
    { status: 'contacted', label: 'Contacted Now', icon: 'bi-telephone-fill', color: 'primary' },
    { status: 'wrong_number', label: 'Wrong Number', icon: 'bi-x-circle', color: 'danger' },
    { status: 'follow_up_due', label: 'Set Follow-up', icon: 'bi-calendar-check', color: 'info' },
  ],
  asked_to_connect_later: [
    { status: 'contacted', label: 'Re-contacted', icon: 'bi-telephone-fill', color: 'primary' },
    { status: 'interested', label: 'Mark Interested', icon: 'bi-hand-thumbs-up-fill', color: 'success' },
    { status: 'not_interested', label: 'Not Interested', icon: 'bi-hand-thumbs-down', color: 'danger' },
  ],
  follow_up_due: [
    { status: 'contacted', label: 'Contacted', icon: 'bi-telephone-fill', color: 'primary' },
    { status: 'interested', label: 'Mark Interested', icon: 'bi-hand-thumbs-up-fill', color: 'success' },
    { status: 'not_interested', label: 'Not Interested', icon: 'bi-hand-thumbs-down', color: 'danger' },
  ],
  interested: [
    { status: 'screening_scheduled', label: 'Schedule Screening', icon: 'bi-calendar-plus', color: 'primary' },
    { status: 'rejected', label: 'Reject', icon: 'bi-x-lg', color: 'danger' },
    { status: 'dropped', label: 'Dropped', icon: 'bi-dash-circle', color: 'secondary' },
  ],
  screening_scheduled: [
    { status: 'screening_completed', label: 'Screening Done', icon: 'bi-check-circle-fill', color: 'success' },
    { status: 'rejected', label: 'Reject', icon: 'bi-x-lg', color: 'danger' },
    { status: 'dropped', label: 'Dropped', icon: 'bi-dash-circle', color: 'secondary' },
  ],
  screening_completed: [
    { status: 'interview_scheduled', label: 'Schedule Interview', icon: 'bi-camera-video-fill', color: 'primary' },
    { status: 'rejected', label: 'Reject', icon: 'bi-x-lg', color: 'danger' },
    { status: 'dropped', label: 'Dropped', icon: 'bi-dash-circle', color: 'secondary' },
  ],
  interview_scheduled: [
    { status: 'interview_completed', label: 'Interview Done', icon: 'bi-check-circle-fill', color: 'success' },
    { status: 'rejected', label: 'Reject', icon: 'bi-x-lg', color: 'danger' },
    { status: 'dropped', label: 'Dropped', icon: 'bi-dash-circle', color: 'secondary' },
  ],
  interview_completed: [
    { status: 'submitted', label: 'Submit Candidate', icon: 'bi-send-fill', color: 'primary' },
    { status: 'rejected', label: 'Reject', icon: 'bi-x-lg', color: 'danger' },
    { status: 'dropped', label: 'Dropped', icon: 'bi-dash-circle', color: 'secondary' },
  ],
  submitted: [
    { status: 'selected', label: 'Mark Selected', icon: 'bi-trophy-fill', color: 'success' },
    { status: 'rejected', label: 'Reject', icon: 'bi-x-lg', color: 'danger' },
    { status: 'dropped', label: 'Dropped', icon: 'bi-dash-circle', color: 'secondary' },
  ],
  selected: [
    { status: 'offer_released', label: 'Release Offer', icon: 'bi-file-earmark-check-fill', color: 'success' },
    { status: 'rejected', label: 'Reject', icon: 'bi-x-lg', color: 'danger' },
    { status: 'dropped', label: 'Dropped', icon: 'bi-dash-circle', color: 'secondary' },
  ],
  offer_released: [
    { status: 'joined', label: 'Mark Joined', icon: 'bi-person-check-fill', color: 'success' },
    { status: 'dropped', label: 'Dropped', icon: 'bi-dash-circle', color: 'secondary' },
  ],
};

const PIPELINE_STEPS = [
  'interested', 'screening_scheduled', 'screening_completed',
  'interview_scheduled', 'interview_completed', 'submitted',
  'selected', 'offer_released', 'joined',
];

function LifecycleProgress({ currentStatus }) {
  const idx = PIPELINE_STEPS.indexOf(currentStatus);
  if (idx < 0) return null;
  return (
    <div className="lifecycle-progress">
      {PIPELINE_STEPS.map((step, i) => (
        <div key={step} className={`lifecycle-step ${i <= idx ? 'completed' : ''} ${i === idx ? 'current' : ''}`}>
          <div className="lifecycle-dot">
            {i < idx ? <i className="bi bi-check"></i> : <span>{i + 1}</span>}
          </div>
          {i < PIPELINE_STEPS.length - 1 && <div className="lifecycle-line" />}
        </div>
      ))}
    </div>
  );
}

export default function CandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdminOrSubadmin } = useAuth();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [notes, setNotes] = useState([]);
  const [activity, setActivity] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [recruiters, setRecruiters] = useState([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [actionRemarks, setActionRemarks] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const [interviewForm, setInterviewForm] = useState({
    interviewer_name: '', interviewer_email: '', interview_type: 'screening',
    scheduled_at: '', duration_minutes: 30, notes: '',
  });
  const [showInterviewForm, setShowInterviewForm] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);

  useEffect(() => { loadCandidate(); }, [id]);

  useEffect(() => {
    if (candidate) {
      loadNotes();
      loadActivity();
      loadInterviews();
      loadBookings();
    }
  }, [candidate?.id]);

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
      loadRecruiters();
    } catch (err) {
      setError('Failed to load candidate.');
    } finally {
      setLoading(false);
    }
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

  const loadBookings = async () => {
    setBookingsLoading(true);
    try {
      const { data } = await bookingsAPI.list({ candidate: id });
      setBookings(data.results || data);
    } catch {}
    finally { setBookingsLoading(false); }
  };

  const handleConfirmBooking = async (bookingId) => {
    try {
      await bookingsAPI.confirm(bookingId);
      loadBookings();
      setSuccess('Booking confirmed.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to confirm booking.');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await bookingsAPI.cancel(bookingId, {});
      loadBookings();
      setSuccess('Booking cancelled.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to cancel booking.');
    }
  };

  const handleLifecycleAction = async (newStatus) => {
    setError(''); setSuccess('');
    try {
      const { data } = await candidatesAPI.updateStatus(id, {
        status: newStatus, remarks: actionRemarks,
        is_admin_override: isAdminOrSubadmin,
      });
      setCandidate(data);
      setConfirmAction(null);
      setActionRemarks('');
      setSuccess(`Status updated to ${STATUS_LABELS[newStatus]}.`);
      loadActivity();
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
    } catch {
      setError('Failed to add note.');
    }
  };

  const handleFollowUp = async () => {
    setError('');
    try {
      const { data } = await candidatesAPI.setFollowUp(id, { follow_up_date: followUpDate || null });
      setCandidate(data);
      setSuccess('Follow-up date updated.');
    } catch {
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

  const actions = LIFECYCLE_ACTIONS[candidate.current_status] || [];
  const isTerminal = ['joined', 'rejected', 'dropped', 'not_interested', 'wrong_number', 'invalid_contact', 'duplicate', 'do_not_contact'].includes(candidate.current_status);
  const isPipeline = candidate.current_bucket === 'pipeline';

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <button className="btn btn-link text-muted p-0 mb-1 d-flex align-items-center gap-1" style={{fontSize:'0.8rem',textDecoration:'none'}} onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left"></i> Back to list
          </button>
          <h4 className="mb-1">{candidate.first_name} {candidate.last_name}</h4>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <span className="badge bg-secondary">{BUCKET_LABELS[candidate.current_bucket]}</span>
            <span className={getStatusBadgeClass(candidate.current_status)}>
              {STATUS_LABELS[candidate.current_status]}
            </span>
            {candidate.assigned_recruiter_detail && (
              <span className="text-muted" style={{fontSize:'0.8rem'}}>
                <i className="bi bi-person me-1"></i>
                {candidate.assigned_recruiter_detail.full_name}
              </span>
            )}
          </div>
        </div>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      {isPipeline && <LifecycleProgress currentStatus={candidate.current_status} />}

      {/* Lifecycle Actions */}
      {!isTerminal && actions.length > 0 && (
        <div className="table-container p-3 mb-3">
          <div className="d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-lightning-fill" style={{color:'var(--primary)'}}></i>
            <h6 className="mb-0">Next Steps</h6>
          </div>
          {confirmAction ? (
            <div>
              <p className="small text-muted mb-2">
                Changing status to <strong>{STATUS_LABELS[confirmAction]}</strong>
              </p>
              <textarea className="form-control form-control-sm mb-2" rows="2"
                placeholder="Remarks (optional)" value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)} />
              <div className="d-flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => handleLifecycleAction(confirmAction)}>
                  Confirm
                </button>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => { setConfirmAction(null); setActionRemarks(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="d-flex gap-2 flex-wrap">
              {actions.map((action) => (
                <button key={action.status}
                  className={`btn btn-${action.color === 'primary' || action.color === 'success' ? '' : 'outline-'}${action.color} btn-sm d-flex align-items-center gap-1`}
                  onClick={() => setConfirmAction(action.status)}>
                  <i className={`bi ${action.icon}`}></i>
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isTerminal && (
        <div className="alert alert-secondary d-flex align-items-center gap-2 mb-3" style={{fontSize:'0.85rem'}}>
          <i className="bi bi-lock-fill"></i>
          This candidate is in a terminal status. No further actions available.
        </div>
      )}

      {/* Two-column layout */}
      <div className="row g-3">
        {/* Left column - Candidate Info */}
        <div className="col-lg-8">
          <div className="table-container p-3 mb-3">
            {editing ? (
              <div>
                <div className="d-flex justify-content-between mb-3">
                  <h6 className="mb-0">Edit Details</h6>
                </div>
                <div className="row g-3">
                  {['first_name', 'last_name', 'email', 'phone', 'alternate_phone', 'source'].map((field) => (
                    <div className="col-md-6" key={field}>
                      <label className="form-label text-capitalize">{field.replace(/_/g, ' ')}</label>
                      <input type="text" className="form-control form-control-sm"
                        value={editForm[field] || ''}
                        onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 d-flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={handleEditSave}>Save Changes</button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="d-flex justify-content-between mb-3">
                  <h6 className="mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-person-vcard" style={{color:'var(--primary)'}}></i> Contact Information
                  </h6>
                  <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1" onClick={() => setEditing(true)}>
                    <i className="bi bi-pencil"></i> Edit
                  </button>
                </div>
                <div className="row">
                  <div className="col-md-6">
                    <div className="detail-field">
                      <div className="detail-label">Email</div>
                      <div className="detail-value">
                        <a href={`mailto:${candidate.email}`}>{candidate.email}</a>
                      </div>
                    </div>
                    <div className="detail-field">
                      <div className="detail-label">Phone</div>
                      <div className="detail-value">
                        <a href={`tel:${candidate.phone}`}>{candidate.phone}</a>
                      </div>
                    </div>
                    <div className="detail-field">
                      <div className="detail-label">Alt Phone</div>
                      <div className="detail-value">{candidate.alternate_phone || '-'}</div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="detail-field">
                      <div className="detail-label">Source</div>
                      <div className="detail-value">{candidate.source || '-'}</div>
                    </div>
                    <div className="detail-field">
                      <div className="detail-label">Created</div>
                      <div className="detail-value">{formatDateTime(candidate.created_at)}</div>
                    </div>
                    <div className="detail-field">
                      <div className="detail-label">Created By</div>
                      <div className="detail-value">{candidate.created_by_name || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="table-container mb-3">
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-chat-left-text-fill" style={{color:'var(--primary)'}}></i>
                <h6 className="mb-0">Notes ({notes.length})</h6>
              </div>
            </div>
            <div className="p-3">
              <div className="d-flex gap-2 mb-3">
                <input type="text" className="form-control form-control-sm" placeholder="Add a note..."
                  value={newNote} onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()} />
                <button className="btn btn-primary btn-sm flex-shrink-0" onClick={handleAddNote} disabled={!newNote.trim()}>
                  <i className="bi bi-plus-lg"></i> Add
                </button>
              </div>
              {notes.length === 0 ? (
                <p className="text-muted small mb-0">No notes yet.</p>
              ) : (
                <div className="notes-list">
                  {notes.map((n) => (
                    <div key={n.id} className="note-item">
                      <div className="d-flex justify-content-between">
                        <small className="fw-medium">{n.created_by_name || 'System'}</small>
                        <small className="text-muted">{formatDateTime(n.created_at)}</small>
                      </div>
                      <div className="mt-1" style={{fontSize:'0.85rem'}}>{n.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Interviews Section */}
          <div className="table-container mb-3">
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-camera-video-fill" style={{color:'var(--primary)'}}></i>
                <h6 className="mb-0">Interviews</h6>
              </div>
              <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowInterviewForm(!showInterviewForm)}>
                <i className={`bi ${showInterviewForm ? 'bi-x-lg' : 'bi-plus-lg'}`}></i>
                {showInterviewForm ? 'Cancel' : 'Schedule'}
              </button>
            </div>
            {showInterviewForm && (
              <div className="p-3 border-bottom" style={{background:'var(--primary-bg)'}}>
                <form onSubmit={handleScheduleInterview}>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <input type="text" className="form-control form-control-sm" placeholder="Interviewer Name" required
                        value={interviewForm.interviewer_name}
                        onChange={(e) => setInterviewForm({...interviewForm, interviewer_name: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                      <input type="email" className="form-control form-control-sm" placeholder="Interviewer Email" required
                        value={interviewForm.interviewer_email}
                        onChange={(e) => setInterviewForm({...interviewForm, interviewer_email: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <select className="form-select form-select-sm" value={interviewForm.interview_type}
                        onChange={(e) => setInterviewForm({...interviewForm, interview_type: e.target.value})}>
                        <option value="screening">Screening</option>
                        <option value="technical">Technical</option>
                        <option value="hr">HR</option>
                        <option value="final">Final</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <input type="datetime-local" className="form-control form-control-sm" required
                        value={interviewForm.scheduled_at}
                        onChange={(e) => setInterviewForm({...interviewForm, scheduled_at: e.target.value})} />
                    </div>
                    <div className="col-md-2">
                      <input type="number" className="form-control form-control-sm" placeholder="Min"
                        value={interviewForm.duration_minutes}
                        onChange={(e) => setInterviewForm({...interviewForm, duration_minutes: parseInt(e.target.value)})} />
                    </div>
                    <div className="col-md-3">
                      <button type="submit" className="btn btn-primary btn-sm w-100">Schedule</button>
                    </div>
                  </div>
                </form>
              </div>
            )}
            <table className="table table-sm mb-0">
              <thead><tr><th>Type</th><th>Interviewer</th><th>Scheduled</th><th>Duration</th><th>Status</th><th>Zoom</th></tr></thead>
              <tbody>
                {(Array.isArray(interviews) ? interviews : []).length === 0 ? (
                  <tr><td colSpan="6" className="text-center text-muted py-3">No interviews scheduled.</td></tr>
                ) : (Array.isArray(interviews) ? interviews : []).map((iv) => (
                  <tr key={iv.id}>
                    <td className="text-capitalize"><small>{iv.interview_type}</small></td>
                    <td><small>{iv.interviewer_name}</small></td>
                    <td><small style={{fontFamily:'monospace'}}>{formatDateTime(iv.scheduled_at)}</small></td>
                    <td><small>{iv.duration_minutes}m</small></td>
                    <td><span className={`badge bg-${iv.status === 'scheduled' ? 'primary' : iv.status === 'completed' ? 'success' : 'danger'}`}>{iv.status}</span></td>
                    <td>{iv.zoom_join_url ? <a href={iv.zoom_join_url} target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-sm" style={{fontSize:'0.7rem',padding:'2px 6px'}}><i className="bi bi-camera-video"></i></a> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bookings Section */}
          <div className="table-container mb-3">
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-calendar-event-fill" style={{color:'var(--primary)'}}></i>
                <h6 className="mb-0">Bookings</h6>
              </div>
              <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowBookModal(true)}>
                <i className="bi bi-plus-lg"></i> Book Interview
              </button>
            </div>
            {bookingsLoading ? (
              <div className="p-3 text-center text-muted small">Loading bookings...</div>
            ) : (
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Slot Date</th><th>Time</th><th>Location</th><th>Round</th>
                    <th>Status</th><th>Booked By</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(bookings) ? bookings : []).length === 0 ? (
                    <tr><td colSpan="7" className="text-center text-muted py-3">No bookings yet.</td></tr>
                  ) : (Array.isArray(bookings) ? bookings : []).map((bk) => (
                    <tr key={bk.id}>
                      <td><small style={{fontFamily:'monospace'}}>{formatDate(bk.slot_date || bk.slot?.date)}</small></td>
                      <td><small style={{fontFamily:'monospace'}}>{bk.slot_start_time?.slice(0, 5)}{bk.slot_end_time ? ` - ${bk.slot_end_time.slice(0, 5)}` : ''}</small></td>
                      <td><small>{bk.location_name || '-'}</small></td>
                      <td><small className="text-capitalize">{bk.round || '-'}</small></td>
                      <td>
                        <span className={`badge bg-${
                          bk.status === 'confirmed' ? 'success' :
                          bk.status === 'pending' ? 'warning' :
                          bk.status === 'cancelled' ? 'secondary' :
                          bk.status === 'no_show' ? 'danger' : 'secondary'
                        }`}>
                          {bk.status}
                        </span>
                      </td>
                      <td><small>{bk.booked_by_name || bk.booked_by?.full_name || '-'}</small></td>
                      <td>
                        <div className="d-flex gap-1">
                          {bk.status === 'pending' && (
                            <button className="btn btn-outline-success btn-sm" style={{fontSize:'0.7rem',padding:'2px 6px'}}
                              onClick={() => handleConfirmBooking(bk.id)} title="Confirm">
                              <i className="bi bi-check-lg"></i>
                            </button>
                          )}
                          {(bk.status === 'pending' || bk.status === 'confirmed') && (
                            <button className="btn btn-outline-danger btn-sm" style={{fontSize:'0.7rem',padding:'2px 6px'}}
                              onClick={() => handleCancelBooking(bk.id)} title="Cancel">
                              <i className="bi bi-x-lg"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="table-container">
            <div className="p-3 border-bottom d-flex align-items-center gap-2">
              <i className="bi bi-activity" style={{color:'var(--primary)'}}></i>
              <h6 className="mb-0">Activity Timeline</h6>
            </div>
            {activity.length === 0 ? (
              <div className="p-3 text-muted small">No activity yet.</div>
            ) : (
              <div className="p-3">
                <div className="activity-timeline">
                  {activity.slice(0, 20).map((log) => (
                    <div key={log.id} className="timeline-item">
                      <div className="timeline-dot"></div>
                      <div className="timeline-content">
                        <div className="d-flex justify-content-between">
                          <span className="badge bg-secondary" style={{fontFamily:'monospace',fontSize:'0.7rem'}}>
                            {log.action_type?.replace(/_/g, ' ')}
                          </span>
                          <small className="text-muted">{formatDateTime(log.created_at)}</small>
                        </div>
                        <div className="mt-1" style={{fontSize:'0.82rem'}}>
                          {log.old_value && log.new_value ? (
                            <span>{log.old_value} <i className="bi bi-arrow-right mx-1"></i> {log.new_value}</span>
                          ) : (
                            <span>{log.new_value || log.old_value || '-'}</span>
                          )}
                        </div>
                        {log.remarks && <small className="text-muted d-block mt-1">{log.remarks}</small>}
                        <small className="text-muted">{log.performed_by_name || 'System'}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Sidebar widgets */}
        <div className="col-lg-4">
          {/* Quick Info Card */}
          <div className="table-container p-3 mb-3">
            <h6 className="mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-info-circle-fill" style={{color:'var(--primary)'}}></i> Quick Info
            </h6>
            <div className="detail-field">
              <div className="detail-label">Status</div>
              <div className="detail-value">
                <span className={getStatusBadgeClass(candidate.current_status)}>
                  {STATUS_LABELS[candidate.current_status]}
                </span>
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Bucket</div>
              <div className="detail-value">{BUCKET_LABELS[candidate.current_bucket]}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Recruiter</div>
              <div className="detail-value">{candidate.assigned_recruiter_detail?.full_name || 'Unassigned'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Follow-up</div>
              <div className="detail-value">{formatDate(candidate.follow_up_date)}</div>
            </div>
          </div>

          {/* Follow-up Date */}
          <div className="table-container p-3 mb-3">
            <h6 className="mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-calendar-check" style={{color:'var(--warning)'}}></i> Follow-up Date
            </h6>
            <div className="input-group input-group-sm">
              <input type="date" className="form-control" value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)} />
              <button className="btn btn-outline-primary" onClick={handleFollowUp}>Set</button>
            </div>
          </div>

          {/* Reassign Recruiter */}
          {isAdminOrSubadmin && (
            <div className="table-container p-3 mb-3">
              <h6 className="mb-2 d-flex align-items-center gap-2">
                <i className="bi bi-person-gear" style={{color:'var(--info)'}}></i> Reassign
              </h6>
              <div className="input-group input-group-sm">
                <select className="form-select" value={selectedRecruiter}
                  onChange={(e) => setSelectedRecruiter(e.target.value)}>
                  <option value="">Select recruiter</option>
                  {recruiters.map((r) => (
                    <option key={r.id} value={r.id}>{r.full_name || `${r.first_name} ${r.last_name}`}</option>
                  ))}
                </select>
                <button className="btn btn-outline-primary" onClick={handleReassign} disabled={!selectedRecruiter}>
                  Reassign
                </button>
              </div>
            </div>
          )}

          {/* Assignment History */}
          <div className="table-container p-3">
            <h6 className="mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-clock-history" style={{color:'var(--text-muted)'}}></i> Assignment History
            </h6>
            {activity.filter(a => a.action_type === 'recruiter_changed' || a.action_type === 'candidate_assigned').length === 0 ? (
              <p className="text-muted small mb-0">No reassignment history.</p>
            ) : (
              activity.filter(a => a.action_type === 'recruiter_changed' || a.action_type === 'candidate_assigned')
                .slice(0, 5).map((log) => (
                <div key={log.id} className="d-flex justify-content-between py-1 border-bottom" style={{fontSize:'0.8rem'}}>
                  <span>{log.new_value || '-'}</span>
                  <small className="text-muted">{formatDate(log.created_at)}</small>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <BookCandidateModal
        show={showBookModal}
        onClose={() => setShowBookModal(false)}
        candidate={candidate}
        onBooked={loadBookings}
      />
    </div>
  );
}
