import { useState } from 'react';
import { feedbackAPI } from '../../services/api';
import AlertMessage from '../common/AlertMessage';

const RECOMMENDATIONS = [
  { value: 'hire', label: 'Hire' },
  { value: 'reject', label: 'Reject' },
  { value: 'next_round', label: 'Next Round' },
  { value: 'hold', label: 'Hold' },
];

export default function FeedbackForm({ show, onClose, interviewId, round, onSubmitted }) {
  const [rating, setRating] = useState(3);
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [recommendation, setRecommendation] = useState('hold');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await feedbackAPI.create({
        interview: interviewId,
        round: round || 'round_1',
        rating,
        strengths,
        weaknesses,
        recommendation,
      });
      onSubmitted?.();
      onClose();
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === 'object') {
        setError(Object.values(detail).flat().join(' ') || 'Failed to submit feedback.');
      } else {
        setError('Failed to submit feedback.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-star me-2"></i>Submit Interview Feedback
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <AlertMessage message={error} onClose={() => setError('')} />

              <div className="mb-3">
                <label className="form-label">Rating (1-5)</label>
                <div className="d-flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="btn p-0 border-0"
                      style={{ fontSize: '1.5rem', color: star <= rating ? '#f59e0b' : '#d1d5db' }}
                      onClick={() => setRating(star)}
                    >
                      <i className={`bi bi-star${star <= rating ? '-fill' : ''}`}></i>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Strengths</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="What were the candidate's strengths?"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Weaknesses</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={weaknesses}
                  onChange={(e) => setWeaknesses(e.target.value)}
                  placeholder="What areas need improvement?"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Recommendation</label>
                <select
                  className="form-select"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                >
                  {RECOMMENDATIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary d-flex align-items-center gap-2"
                disabled={submitting}
              >
                {submitting ? (
                  <><span className="spinner-border spinner-border-sm"></span> Submitting...</>
                ) : (
                  <><i className="bi bi-check-circle"></i> Submit Feedback</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
