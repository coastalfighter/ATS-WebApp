import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidatesAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';
import { STATUS_LABELS, getStatusBadgeClass, formatDate } from '../utils/statusHelpers';

export default function DuplicateReviewPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await candidatesAPI.duplicates({ page });
      setCandidates(res.data.results || res.data);
      setCount(res.data.count || 0);
      setTotalPages(Math.ceil((res.data.count || 0) / 25));
    } catch (err) {
      setError('Failed to load duplicates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page]);

  const handleMarkDuplicate = async (id) => {
    if (!window.confirm('Mark this candidate as duplicate status?')) return;
    try {
      await candidatesAPI.updateStatus(id, {
        status: 'duplicate',
        remarks: 'Marked as duplicate from review page',
        is_admin_override: true,
      });
      setSuccess('Candidate marked as duplicate.');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>Duplicate Review</h1>
        <span className="badge bg-secondary">{count} duplicates</span>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="table-container">
        <table className="table table-hover table-sm mb-0">
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Source</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-4 text-muted">No duplicates found.</td></tr>
            ) : candidates.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td className="cursor-pointer fw-medium" onClick={() => navigate(`/candidates/${c.id}`)}>
                  {c.first_name} {c.last_name}
                </td>
                <td><small>{c.email}</small></td>
                <td><small>{c.phone}</small></td>
                <td><span className={getStatusBadgeClass(c.current_status)}>{STATUS_LABELS[c.current_status] || c.current_status}</span></td>
                <td><small>{c.source || '-'}</small></td>
                <td><small>{formatDate(c.created_at)}</small></td>
                <td>
                  <div className="d-flex gap-1">
                    <button className="btn btn-outline-primary btn-sm py-0 px-1" title="View"
                      onClick={() => navigate(`/candidates/${c.id}`)}>
                      <i className="bi bi-eye"></i>
                    </button>
                    {c.current_status !== 'duplicate' && (
                      <button className="btn btn-outline-warning btn-sm py-0 px-1" title="Mark as Duplicate"
                        onClick={() => handleMarkDuplicate(c.id)}>
                        <i className="bi bi-flag"></i>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
