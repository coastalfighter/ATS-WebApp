import { useState, useEffect } from 'react';
import { interviewSlotsAPI, bookingsAPI } from '../../services/api';
import AlertMessage from '../common/AlertMessage';

export default function BookCandidateModal({ show, onClose, candidate, onBooked }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [round, setRound] = useState('round_1');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    if (show) {
      fetchSlots();
      setSelectedSlot('');
      setError('');
      setSuccess('');
    }
  }, [show, dateFilter]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const params = { active_only: 'true' };
      if (dateFilter) params.date_from = dateFilter;
      const { data } = await interviewSlotsAPI.list(params);
      const available = (data.results || data).filter(
        s => s.status !== 'fully_booked' && s.status !== 'cancelled'
      );
      setSlots(available);
    } catch {
      setError('Failed to load available slots.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select a slot.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await bookingsAPI.create({
        candidate: candidate.id,
        interview_slot: parseInt(selectedSlot),
        round,
      });
      setSuccess('Candidate booked successfully!');
      onBooked?.();
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === 'object') {
        const messages = Object.values(detail).flat().join(' ');
        setError(messages || 'Failed to create booking.');
      } else {
        setError('Failed to create booking.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-bookmark-plus me-2"></i>
              Book Interview - {candidate?.full_name || `${candidate?.first_name} ${candidate?.last_name}`}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <AlertMessage message={error} onClose={() => setError('')} />
              {success && (
                <div className="alert alert-success">
                  <i className="bi bi-check-circle me-2"></i>{success}
                </div>
              )}

              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Round</label>
                  <select
                    className="form-select"
                    value={round}
                    onChange={(e) => setRound(e.target.value)}
                  >
                    <option value="round_1">Round 1</option>
                    <option value="round_2">Round 2</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Filter by Date (from)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                </div>
              </div>

              <label className="form-label">Available Slots</label>
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border spinner-border-sm text-primary"></div>
                  <span className="ms-2">Loading slots...</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="alert alert-info mb-0">
                  <i className="bi bi-info-circle me-2"></i>
                  No available slots found. Try adjusting the date filter.
                </div>
              ) : (
                <div className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {slots.map(slot => (
                    <label
                      key={slot.id}
                      className={`list-group-item list-group-item-action d-flex align-items-center gap-3 ${
                        selectedSlot === String(slot.id) ? 'active' : ''
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="radio"
                        name="slot"
                        value={slot.id}
                        checked={selectedSlot === String(slot.id)}
                        onChange={(e) => setSelectedSlot(e.target.value)}
                        className="form-check-input mt-0"
                      />
                      <div className="flex-grow-1">
                        <div className="fw-semibold">
                          {slot.location_name}
                          {slot.round_type && (
                            <span className="badge bg-secondary ms-2" style={{ fontSize: '0.7rem' }}>
                              {slot.round_type === 'round_1' ? 'R1' : 'R2'}
                            </span>
                          )}
                        </div>
                        <small className="text-muted">
                          <i className="bi bi-calendar3 me-1"></i>
                          {slot.date} | {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        </small>
                        <br />
                        <small className="text-muted">
                          <i className="bi bi-person me-1"></i>
                          {slot.hiring_manager_name}
                        </small>
                      </div>
                      <div className="text-end">
                        <span className={`badge ${
                          slot.available_capacity > 2 ? 'bg-success' :
                          slot.available_capacity > 0 ? 'bg-warning' : 'bg-danger'
                        }`}>
                          {slot.available_capacity ?? (slot.max_capacity - slot.booked_count)}/{slot.max_capacity}
                        </span>
                        <br />
                        <small className="text-muted">available</small>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary d-flex align-items-center gap-2"
                disabled={submitting || !selectedSlot}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm"></span>
                    Booking...
                  </>
                ) : (
                  <>
                    <i className="bi bi-bookmark-check"></i>
                    Book Candidate
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
