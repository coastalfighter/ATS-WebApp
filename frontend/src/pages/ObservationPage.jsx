import { useState, useEffect, useCallback } from 'react';
import { observationsAPI, interviewsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';

const RECOMMENDATION_COLORS = {
  proceed: 'success',
  extend_training: 'warning',
  reject: 'danger',
};

const RECOMMENDATION_LABELS = {
  proceed: 'Proceed',
  extend_training: 'Extend Training',
  reject: 'Reject',
};

export default function ObservationPage() {
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [form, setForm] = useState({
    interview: '',
    observation_date: new Date().toISOString().slice(0, 10),
    performance_score: 5,
    communication_score: 5,
    technical_score: 5,
    notes: '',
    recommendation: 'proceed',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadObservations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await observationsAPI.list({ page });
      setObservations(data.results || []);
      setCount(data.count || 0);
      setTotalPages(Math.ceil((data.count || 0) / 25));
    } catch {
      setError('Failed to load observations.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadObservations(); }, [loadObservations]);

  const openForm = async () => {
    setShowForm(true);
    setFormError('');
    try {
      const { data } = await interviewsAPI.list({ status: 'scheduled' });
      setInterviews(data.results || []);
    } catch {
      setInterviews([]);
    }
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.interview) {
      setFormError('Please select an interview.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await observationsAPI.create({
        ...form,
        interview: Number(form.interview),
        performance_score: Number(form.performance_score),
        communication_score: Number(form.communication_score),
        technical_score: Number(form.technical_score),
      });
      setShowForm(false);
      setSuccess('Observation submitted successfully.');
      loadObservations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === 'object') {
        setFormError(Object.values(detail).flat().join(' ') || 'Failed to submit observation.');
      } else {
        setFormError('Failed to submit observation.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fresh-leads">
      <div className="fl-header">
        <span className="fl-badge">TRAINING</span>
        <h1 className="fl-title">Observation Sheets</h1>
        <p className="fl-subtitle">Trainer observations for Round 2 candidates</p>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />
      {success && (
        <div className="alert alert-success d-flex align-items-center gap-2 py-2" style={{ fontSize: '0.875rem' }}>
          <i className="bi bi-check-circle-fill"></i> {success}
          <button className="btn-close ms-auto" style={{ fontSize: '0.65rem' }} onClick={() => setSuccess('')}></button>
        </div>
      )}

      <div className="fl-master-section">
        <div className="fl-master-header">
          <div>
            <h2 className="fl-master-title">Observations</h2>
            <p className="fl-master-sub"><strong>{count}</strong> records</p>
          </div>
        </div>
        <div className="fl-filters">
          <button className="fl-btn fl-btn-primary" onClick={openForm}>
            <i className="bi bi-plus-circle"></i> New Observation
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="table-container">
            <table className="table table-hover table-sm mb-0">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Trainer</th>
                  <th>Date</th>
                  <th>Performance</th>
                  <th>Communication</th>
                  <th>Technical</th>
                  <th>Avg</th>
                  <th>Recommendation</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {observations.length === 0 ? (
                  <tr><td colSpan="9" className="text-center text-muted py-4">No observation sheets found.</td></tr>
                ) : observations.map((o) => {
                  const avg = ((o.performance_score + o.communication_score + o.technical_score) / 3).toFixed(1);
                  return (
                    <tr key={o.id}>
                      <td className="fw-medium">{o.candidate_name || '-'}</td>
                      <td><small>{o.trainer_name || '-'}</small></td>
                      <td><small>{o.observation_date}</small></td>
                      <td className="text-center">{o.performance_score}/10</td>
                      <td className="text-center">{o.communication_score}/10</td>
                      <td className="text-center">{o.technical_score}/10</td>
                      <td className="text-center fw-semibold">{avg}</td>
                      <td>
                        <span className={`badge bg-${RECOMMENDATION_COLORS[o.recommendation] || 'secondary'}`}
                          style={{ fontSize: '0.72rem' }}>
                          {RECOMMENDATION_LABELS[o.recommendation] || o.recommendation}
                        </span>
                      </td>
                      <td><small className="text-muted">{o.notes?.slice(0, 50)}{o.notes?.length > 50 ? '...' : ''}</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-3">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-clipboard-check me-2"></i>New Observation Sheet
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowForm(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {formError && (
                    <div className="alert alert-danger py-2" style={{ fontSize: '0.8125rem' }}>{formError}</div>
                  )}

                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Interview <span className="text-danger">*</span></label>
                      <select className="form-select" name="interview" value={form.interview} onChange={handleFormChange} required>
                        <option value="">Select interview...</option>
                        {interviews.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.candidate_detail?.full_name || `Interview #${i.id}`} - {i.interview_type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Observation Date</label>
                      <input type="date" className="form-control" name="observation_date"
                        value={form.observation_date} onChange={handleFormChange} />
                    </div>
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-4">
                      <label className="form-label">Performance Score (1-10)</label>
                      <input type="number" className="form-control" name="performance_score"
                        min="1" max="10" value={form.performance_score} onChange={handleFormChange} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Communication Score (1-10)</label>
                      <input type="number" className="form-control" name="communication_score"
                        min="1" max="10" value={form.communication_score} onChange={handleFormChange} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Technical Score (1-10)</label>
                      <input type="number" className="form-control" name="technical_score"
                        min="1" max="10" value={form.technical_score} onChange={handleFormChange} />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" name="notes" rows="3"
                      value={form.notes} onChange={handleFormChange}
                      placeholder="Detailed observations..." />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Recommendation</label>
                    <select className="form-select" name="recommendation" value={form.recommendation} onChange={handleFormChange}>
                      <option value="proceed">Proceed</option>
                      <option value="extend_training">Extend Training</option>
                      <option value="reject">Reject</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={submitting}>
                    {submitting ? (
                      <><span className="spinner-border spinner-border-sm"></span> Submitting...</>
                    ) : (
                      <><i className="bi bi-clipboard-check"></i> Submit Observation</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
