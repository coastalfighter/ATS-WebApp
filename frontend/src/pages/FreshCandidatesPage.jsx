import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidatesAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';
import { STATUS_LABELS, getStatusBadgeClass, formatDate } from '../utils/statusHelpers';

export default function FreshCandidatesPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadCandidates(); }, [page, statusFilter]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const params = { page };
      if (search) params.search = search;
      if (statusFilter) params.current_status = statusFilter;
      const { data } = await candidatesAPI.fresh(params);
      setCandidates(data.results || []);
      setTotalPages(Math.ceil((data.count || 0) / 25));
    } catch (err) {
      setError('Failed to load candidates.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadCandidates();
  };

  const freshStatuses = [
    'never_contacted', 'contacted', 'unanswered', 'not_interested',
    'asked_to_connect_later', 'wrong_number', 'invalid_contact',
    'duplicate', 'do_not_contact', 'follow_up_due', 'interested',
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Fresh Candidates</h1>
        <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => navigate('/candidates/upload')}>
          <i className="bi bi-cloud-arrow-up"></i> Upload CSV/XLSX
        </button>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="filter-bar">
        <form onSubmit={handleSearch} className="row g-2 align-items-end">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              {freshStatuses.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-outline-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-1">
              <i className="bi bi-search"></i> Search
            </button>
          </div>
        </form>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="table-container">
            <table className="table table-hover table-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Recruiter</th>
                  <th>Follow-up</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr><td colSpan="8" className="text-center text-muted py-4">No candidates found.</td></tr>
                ) : (
                  candidates.map((c) => (
                    <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/candidates/${c.id}`)}>
                      <td className="fw-medium">{c.first_name} {c.last_name}</td>
                      <td>{c.email}</td>
                      <td>{c.phone}</td>
                      <td>{c.source || '-'}</td>
                      <td><span className={getStatusBadgeClass(c.current_status)}>{STATUS_LABELS[c.current_status] || c.current_status}</span></td>
                      <td>{c.assigned_recruiter_name || '-'}</td>
                      <td>{formatDate(c.follow_up_date)}</td>
                      <td>{formatDate(c.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
