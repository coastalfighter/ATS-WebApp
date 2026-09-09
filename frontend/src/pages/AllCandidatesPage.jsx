import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidatesAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';
import StatusUpdateModal from '../components/common/StatusUpdateModal';
import { STATUS_LABELS, BUCKET_LABELS, getStatusBadgeClass, formatDate } from '../utils/statusHelpers';

export default function AllCandidatesPage() {
  const navigate = useNavigate();
  const { isAdminOrSubadmin } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [bucketFilter, setBucketFilter] = useState('');
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ordering, setOrdering] = useState('-created_at');
  const [recruiters, setRecruiters] = useState([]);
  const [statusCandidate, setStatusCandidate] = useState(null);

  useEffect(() => {
    if (isAdminOrSubadmin) {
      usersAPI.getRecruiters({ active_only: false }).then(({ data }) => setRecruiters(data)).catch(() => {});
    }
  }, []);

  useEffect(() => { loadCandidates(); }, [page, statusFilter, bucketFilter, recruiterFilter, ordering]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const params = { page, ordering };
      if (search) params.search = search;
      if (statusFilter) params.current_status = statusFilter;
      if (bucketFilter) params.current_bucket = bucketFilter;
      if (recruiterFilter) params.assigned_recruiter = recruiterFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (dateFrom) params.created_after = dateFrom;
      if (dateTo) params.created_before = dateTo;
      const { data } = await candidatesAPI.list(params);
      setCandidates(data.results || []);
      setCount(data.count || 0);
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

  const handleSort = (field) => {
    setOrdering(ordering === field ? `-${field}` : field);
    setPage(1);
  };

  const SortHeader = ({ field, children }) => (
    <th className="cursor-pointer" onClick={() => handleSort(field)}>
      {children} {ordering === field ? <i className="bi bi-sort-up"></i> : ordering === `-${field}` ? <i className="bi bi-sort-down"></i> : <i className="bi bi-chevron-expand" style={{opacity:0.3}}></i>}
    </th>
  );

  const allStatuses = [
    'never_contacted', 'contacted', 'unanswered', 'not_interested',
    'asked_to_connect_later', 'wrong_number', 'invalid_contact',
    'duplicate', 'do_not_contact', 'follow_up_due', 'interested',
    'screening_scheduled', 'screening_completed',
    'interview_scheduled', 'interview_completed', 'submitted',
    'rejected', 'selected', 'offer_released', 'joined', 'dropped',
  ];

  return (
    <div>
      <div className="page-header">
        <h1>All Candidates</h1>
        <span className="badge bg-secondary">{count} total</span>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="filter-bar">
        <form onSubmit={handleSearch} className="row g-2 align-items-end">
          <div className="col-md-3">
            <input type="text" className="form-control form-control-sm"
              placeholder="Search name, email, phone..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="col-md-2">
            <select className="form-select form-select-sm" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {allStatuses.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select form-select-sm" value={bucketFilter}
              onChange={(e) => { setBucketFilter(e.target.value); setPage(1); }}>
              <option value="">All Buckets</option>
              <option value="fresh">Fresh</option>
              <option value="pipeline">Pipeline</option>
            </select>
          </div>
          {isAdminOrSubadmin && (
            <div className="col-md-2">
              <select className="form-select form-select-sm" value={recruiterFilter}
                onChange={(e) => { setRecruiterFilter(e.target.value); setPage(1); }}>
                <option value="">All Recruiters</option>
                {recruiters.map((r) => (
                  <option key={r.id} value={r.id}>{r.full_name || `${r.first_name} ${r.last_name}`}</option>
                ))}
              </select>
            </div>
          )}
          <div className="col-md-1">
            <button type="submit" className="btn btn-outline-primary btn-sm w-100">
              <i className="bi bi-search"></i>
            </button>
          </div>
        </form>
        <div className="row g-2 mt-1">
          <div className="col-md-2">
            <input type="text" className="form-control form-control-sm" placeholder="Source..."
              value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} />
          </div>
          <div className="col-md-2">
            <input type="date" className="form-control form-control-sm" placeholder="From date"
              value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="col-md-2">
            <input type="date" className="form-control form-control-sm" placeholder="To date"
              value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="col-md-2">
            <button className="btn btn-outline-secondary btn-sm w-100" onClick={() => {
              setSearch(''); setStatusFilter(''); setBucketFilter('');
              setRecruiterFilter(''); setSourceFilter('');
              setDateFrom(''); setDateTo(''); setPage(1);
              setTimeout(loadCandidates, 0);
            }}>
              <i className="bi bi-x-circle"></i> Clear
            </button>
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="table-container">
            <table className="table table-hover table-sm">
              <thead>
                <tr>
                  <SortHeader field="first_name">Name</SortHeader>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Bucket</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Recruiter</th>
                  <SortHeader field="created_at">Created</SortHeader>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr><td colSpan="9" className="text-center text-muted py-4">No candidates found.</td></tr>
                ) : candidates.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-medium cursor-pointer" onClick={() => navigate(`/candidates/${c.id}`)}>
                      {c.first_name} {c.last_name}
                    </td>
                    <td><small>{c.email}</small></td>
                    <td><small>{c.phone}</small></td>
                    <td><span className="badge bg-secondary">{BUCKET_LABELS[c.current_bucket] || c.current_bucket}</span></td>
                    <td><span className={getStatusBadgeClass(c.current_status)}>{STATUS_LABELS[c.current_status] || c.current_status}</span></td>
                    <td><small>{c.source || '-'}</small></td>
                    <td><small>{c.assigned_recruiter_name || '-'}</small></td>
                    <td><small>{formatDate(c.created_at)}</small></td>
                    <td>
                      <button className="btn btn-outline-primary btn-sm py-0 px-1"
                        title="Update Status"
                        onClick={(e) => { e.stopPropagation(); setStatusCandidate(c); }}>
                        <i className="bi bi-pencil-square"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      <StatusUpdateModal candidate={statusCandidate}
        onClose={() => setStatusCandidate(null)}
        onUpdated={loadCandidates} />
    </div>
  );
}
