import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidatesAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';
import StatusUpdateModal from '../components/common/StatusUpdateModal';
import { STATUS_LABELS, getStatusBadgeClass, formatDate } from '../utils/statusHelpers';

export default function PipelineCandidatesPage() {
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
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ordering, setOrdering] = useState('-created_at');
  const [recruiters, setRecruiters] = useState([]);
  const [statusCandidate, setStatusCandidate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (isAdminOrSubadmin) {
      usersAPI.getRecruiters({ active_only: false }).then(({ data }) => setRecruiters(data)).catch(() => {});
    }
  }, []);

  useEffect(() => { loadCandidates(); }, [page, statusFilter, recruiterFilter, ordering]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const params = { page, ordering };
      if (search) params.search = search;
      if (statusFilter) params.current_status = statusFilter;
      if (recruiterFilter) params.assigned_recruiter = recruiterFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (dateFrom) params.created_after = dateFrom;
      if (dateTo) params.created_before = dateTo;
      const { data } = await candidatesAPI.pipeline(params);
      setCandidates(data.results || []);
      setCount(data.count || 0);
      setTotalPages(Math.ceil((data.count || 0) / 25));
    } catch (err) {
      setError('Failed to load pipeline candidates.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadCandidates();
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setRecruiterFilter('');
    setSourceFilter(''); setDateFrom(''); setDateTo('');
    setPage(1);
    setTimeout(loadCandidates, 0);
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

  const pipelineStatuses = [
    'interested', 'screening_scheduled', 'screening_completed',
    'interview_scheduled', 'interview_completed', 'submitted',
    'rejected', 'selected', 'offer_released', 'joined', 'dropped',
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pipeline Candidates</h1>
          <small className="text-muted">{count} candidates</small>
        </div>
        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={() => setShowFilters(!showFilters)}>
          <i className="bi bi-funnel"></i> {showFilters ? 'Hide Filters' : 'Filters'}
        </button>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="filter-bar">
        <form onSubmit={handleSearch} className="row g-2 align-items-end">
          <div className="col-md-4">
            <input type="text" className="form-control form-control-sm"
              placeholder="Search name, email, phone..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="col-md-3">
            <select className="form-select form-select-sm" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {pipelineStatuses.map((s) => (
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
        {showFilters && (
          <div className="row g-2 mt-1">
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
            <div className="col-md-2">
              <input type="text" className="form-control form-control-sm" placeholder="Source..."
                value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} />
            </div>
            <div className="col-md-2">
              <input type="date" className="form-control form-control-sm" title="From date"
                value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="col-md-2">
              <input type="date" className="form-control form-control-sm" title="To date"
                value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="col-md-2">
              <button className="btn btn-outline-secondary btn-sm w-100" onClick={clearFilters}>
                <i className="bi bi-x-circle"></i> Clear
              </button>
            </div>
          </div>
        )}
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
                  <th>Source</th>
                  <th>Status</th>
                  <th>Recruiter</th>
                  <SortHeader field="created_at">Created</SortHeader>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr><td colSpan="8" className="text-center text-muted py-4">No pipeline candidates found.</td></tr>
                ) : candidates.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-medium cursor-pointer" onClick={() => navigate(`/candidates/${c.id}`)}>
                      {c.first_name} {c.last_name}
                    </td>
                    <td><small>{c.email}</small></td>
                    <td><small>{c.phone}</small></td>
                    <td><small>{c.source || '-'}</small></td>
                    <td><span className={getStatusBadgeClass(c.current_status)}>{STATUS_LABELS[c.current_status] || c.current_status}</span></td>
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
