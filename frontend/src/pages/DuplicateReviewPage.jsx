import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidatesAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import { getStatusLabel, getStatusBadgeClass, formatDate } from '../utils/statusHelpers';

export default function DuplicateReviewPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await candidatesAPI.duplicates({ page });
      setCandidates(res.data.results || res.data);
      setCount(res.data.count || 0);
    } catch (err) {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Duplicate Review</h4>
        <span className="badge bg-secondary fs-6">{count} duplicates</span>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-4 text-muted">No duplicates found.</td></tr>
            ) : candidates.map((c) => (
              <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/candidates/${c.id}`)}>
                <td>{c.id}</td>
                <td><strong>{c.first_name} {c.last_name}</strong></td>
                <td><small>{c.email}</small></td>
                <td><small>{c.phone}</small></td>
                <td><span className={getStatusBadgeClass(c.current_status)}>{getStatusLabel(c.current_status)}</span></td>
                <td><small>{c.source || '-'}</small></td>
                <td><small>{formatDate(c.created_at)}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2">
          <Pagination count={count} currentPage={page} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
