import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { interviewsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';
import { formatDateTime } from '../utils/statusHelpers';

export default function InterviewsPage() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadInterviews(); }, [page, statusFilter]);

  const loadInterviews = async () => {
    setLoading(true);
    try {
      const params = { page };
      if (statusFilter) params.status = statusFilter;
      const { data } = await interviewsAPI.list(params);
      setInterviews(data.results || []);
      setTotalPages(Math.ceil((data.count || 0) / 25));
    } catch (err) {
      setError('Failed to load interviews.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this interview?')) return;
    try {
      await interviewsAPI.cancel(id);
      setSuccess('Interview cancelled.');
      loadInterviews();
    } catch (err) {
      setError('Failed to cancel interview.');
    }
  };

  const handleReminder = async (id) => {
    try {
      await interviewsAPI.sendReminder(id);
      setSuccess('Reminder sent.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reminder.');
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Interviews</h1></div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="filter-bar">
        <div className="row g-2">
          <div className="col-md-3">
            <select className="form-select form-select-sm" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="table-container">
            <table className="table table-hover table-sm">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Type</th>
                  <th>Interviewer</th>
                  <th>Scheduled</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Zoom</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {interviews.length === 0 ? (
                  <tr><td colSpan="8" className="text-center text-muted py-4">No interviews found.</td></tr>
                ) : interviews.map((iv) => (
                  <tr key={iv.id}>
                    <td className="cursor-pointer" onClick={() => navigate(`/candidates/${iv.candidate}`)}>
                      {iv.candidate_detail ? `${iv.candidate_detail.first_name} ${iv.candidate_detail.last_name}` : `#${iv.candidate}`}
                    </td>
                    <td className="text-capitalize">{iv.interview_type}</td>
                    <td>{iv.interviewer_name}</td>
                    <td>{formatDateTime(iv.scheduled_at)}</td>
                    <td>{iv.duration_minutes} min</td>
                    <td>
                      <span className={`badge bg-${iv.status === 'scheduled' ? 'primary' : iv.status === 'completed' ? 'success' : 'danger'}`}>
                        {iv.status}
                      </span>
                    </td>
                    <td>{iv.zoom_join_url ? <a href={iv.zoom_join_url} target="_blank" rel="noreferrer">Join</a> : '-'}</td>
                    <td>
                      {iv.status === 'scheduled' && (
                        <div className="d-flex gap-1">
                          <button className="btn btn-outline-warning btn-sm" onClick={() => handleReminder(iv.id)}>Remind</button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => handleCancel(iv.id)}>Cancel</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3"><Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /></div>
        </>
      )}
    </div>
  );
}
