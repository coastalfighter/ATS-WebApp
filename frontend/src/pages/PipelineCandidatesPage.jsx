import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidatesAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import StatusUpdateModal from '../components/common/StatusUpdateModal';
import BookCandidateModal from '../components/bookings/BookCandidateModal';
import { STATUS_LABELS, getStatusBadgeClass, formatDate } from '../utils/statusHelpers';
import ClickToCallButton from '../components/candidates/ClickToCallButton';

const AVATAR_COLORS = [
  '#4f46e5', '#7c3aed', '#db2777', '#dc2626', '#ea580c',
  '#d97706', '#65a30d', '#059669', '#0891b2', '#2563eb',
  '#7c3aed', '#9333ea', '#c026d3', '#e11d48', '#0d9488',
];

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  const code = name.toUpperCase().charCodeAt(0) - 65;
  return AVATAR_COLORS[Math.abs(code) % AVATAR_COLORS.length];
}

const ROWS_OPTIONS = [20, 50, 100];
const SORT_OPTIONS = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'created_at', label: 'Oldest first' },
  { value: 'first_name', label: 'Name A-Z' },
  { value: '-first_name', label: 'Name Z-A' },
];

const pipelineStatuses = [
  'interested', 'screening_scheduled', 'screening_completed',
  'interview_scheduled', 'interview_completed',
  'round2_scheduled', 'round2_completed',
  'observation', 'training', 'training_completed',
  'submitted', 'rejected', 'selected', 'offer_released',
  'joined', 'dropped', 'hired', 'fastgem_uploaded',
];

export default function PipelineCandidatesPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ordering, setOrdering] = useState('-created_at');
  const [statusCandidate, setStatusCandidate] = useState(null);
  const [bookCandidate, setBookCandidate] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [summary, setSummary] = useState({
    total: 0, screening: 0, interview_scheduled: 0, interview_completed: 0,
    round2: 0, observation: 0, training: 0,
    submitted: 0, selected: 0, joined: 0, hired: 0, rejected: 0,
  });

  const totalPages = Math.ceil(count / rowsPerPage);

  const buildParams = useCallback(() => {
    const params = { page, ordering, page_size: rowsPerPage };
    if (search) params.search = search;
    if (statusFilter) params.current_status = statusFilter;
    if (sourceFilter) params.source = sourceFilter;
    if (dateFrom) params.created_after = dateFrom;
    if (dateTo) params.created_before = dateTo;
    return params;
  }, [page, ordering, rowsPerPage, search, statusFilter, sourceFilter, dateFrom, dateTo]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const { data } = await candidatesAPI.pipeline(params);
      setCandidates(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      setError('Failed to load booked candidates.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const loadSummary = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (sourceFilter) params.source = sourceFilter;
      if (dateFrom) params.created_after = dateFrom;
      if (dateTo) params.created_before = dateTo;
      const { data } = await candidatesAPI.pipelineSummary(params);
      setSummary(data);
    } catch {
      // silently fail
    }
  }, [search, sourceFilter, dateFrom, dateTo]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSourceFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleInlineStatus = async (candidateId, newStatus) => {
    try {
      await candidatesAPI.updateStatus(candidateId, {
        status: newStatus,
        remarks: '',
        is_admin_override: false,
      });
      loadCandidates();
      loadSummary();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const handleRefresh = () => {
    loadCandidates();
    loadSummary();
  };

  const startIdx = (page - 1) * rowsPerPage + 1;
  const endIdx = Math.min(page * rowsPerPage, count);

  const summaryCards = [
    { label: 'TOTAL', value: summary.total, key: '' },
    { label: 'SCREENING', value: summary.screening, key: '_screening' },
    { label: 'INTERVIEW SCHED.', value: summary.interview_scheduled, key: 'interview_scheduled' },
    { label: 'INTERVIEW DONE', value: summary.interview_completed, key: 'interview_completed' },
    { label: 'ROUND 2', value: summary.round2, key: '_round2' },
    { label: 'OBSERVATION', value: summary.observation, key: 'observation' },
    { label: 'TRAINING', value: summary.training, key: '_training' },
    { label: 'SUBMITTED', value: summary.submitted, key: 'submitted' },
    { label: 'SELECTED', value: summary.selected, key: 'selected' },
    { label: 'JOINED', value: summary.joined, key: 'joined' },
    { label: 'HIRED', value: summary.hired, key: '_hired' },
    { label: 'REJECTED', value: summary.rejected, key: '_rejected' },
  ];

  const handleCardClick = (card) => {
    if (card.key === '') {
      setStatusFilter('');
    } else if (card.key === '_screening') {
      setStatusFilter('screening_scheduled');
    } else if (card.key === '_round2') {
      setStatusFilter('round2_scheduled');
    } else if (card.key === '_training') {
      setStatusFilter('training');
    } else if (card.key === '_hired') {
      setStatusFilter('hired');
    } else if (card.key === '_rejected') {
      setStatusFilter('rejected');
    } else {
      setStatusFilter(card.key);
    }
    setPage(1);
  };

  return (
    <div className="fresh-leads">
      {/* Page Header */}
      <div className="fl-header">
        <span className="fl-badge">HIRING OPERATIONS</span>
        <h1 className="fl-title">Booked Candidates</h1>
        <p className="fl-subtitle">Candidates in the interview pipeline</p>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      {/* Master Data Section */}
      <div className="fl-master-section">
        <div className="fl-master-header">
          <div>
            <h2 className="fl-master-title">Pipeline Data</h2>
            <p className="fl-master-sub">Server-side filtered candidates &mdash; <strong>{count}</strong> matched</p>
          </div>
        </div>

        {/* Filters */}
        <form onSubmit={handleSearch} className="fl-filters">
          <input type="text" className="fl-filter-input" placeholder="Search name, email, phone..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="fl-filter-select" value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {pipelineStatuses.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <input type="text" className="fl-filter-input fl-filter-sm" placeholder="Source..."
            value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} />
          <input type="date" className="fl-filter-input fl-filter-sm" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)} title="From date" />
          <input type="date" className="fl-filter-input fl-filter-sm" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)} title="To date" />
          <button type="submit" className="fl-btn fl-btn-primary">
            <i className="bi bi-search"></i> Search
          </button>
          <button type="button" className="fl-btn fl-btn-outline" onClick={clearFilters}>
            <i className="bi bi-x-circle"></i> Clear
          </button>
        </form>
      </div>

      {/* Summary Cards */}
      <div className="fl-summary-grid">
        {summaryCards.map((card) => (
          <div key={card.label} className={`fl-summary-card ${statusFilter === card.key || (card.key === '' && !statusFilter) ? 'active' : ''}`}
            onClick={() => handleCardClick(card)}
            role="button" tabIndex={0}>
            <span className="fl-summary-label">{card.label}</span>
            <span className="fl-summary-value">{card.value}</span>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="fl-controls">
        <span className="fl-showing">
          Showing <strong>{count > 0 ? startIdx : 0}&ndash;{endIdx}</strong> of <strong>{count}</strong> server-filtered candidates
        </span>
        <div className="fl-controls-right">
          <div className="fl-control-group">
            <label className="fl-control-label">Rows per page</label>
            <select className="fl-control-select" value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}>
              {ROWS_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="fl-control-group">
            <label className="fl-control-label">Sort</label>
            <select className="fl-control-select" value={ordering}
              onChange={(e) => { setOrdering(e.target.value); setPage(1); }}>
              {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="fl-pagination-btns">
            <button className="fl-page-btn" disabled={page <= 1} onClick={() => setPage(1)}>First</button>
            <button className="fl-page-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span className="fl-page-num">Page {page}</span>
            <button className="fl-page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            <button className="fl-page-btn" onClick={handleRefresh}>Refresh</button>
          </div>
        </div>
      </div>

      {/* Candidate Cards */}
      {loading ? <LoadingSpinner /> : (
        <div className="fl-cards">
          {candidates.length === 0 ? (
            <div className="fl-empty">
              <i className="bi bi-inbox"></i>
              <p>No booked candidates found.</p>
            </div>
          ) : candidates.map((c) => {
            const initial = (c.first_name || '?')[0].toUpperCase();
            const color = getAvatarColor(c.first_name);
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className="fl-card">
                {/* Card Header */}
                <div className="fl-card-header">
                  <div className="fl-avatar" style={{ backgroundColor: color }}>
                    {initial}
                  </div>
                  <div className="fl-card-name-block">
                    <span className="fl-card-name" onClick={() => navigate(`/candidates/${c.id}`)}>
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="fl-card-email">{c.email || 'No email'}</span>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="fl-card-info-grid">
                  <div className="fl-info-box">
                    <span className="fl-info-label">PHONE</span>
                    <span className="fl-info-value">
                      <i className="bi bi-telephone-fill fl-phone-icon"></i>
                      <a href={`tel:${c.phone}`} className="fl-phone-link">{c.phone || '-'}</a>
                      <ClickToCallButton candidateId={c.id} phone={c.phone} />
                    </span>
                  </div>
                  <div className="fl-info-box">
                    <span className="fl-info-label">SOURCE</span>
                    <span className="fl-info-value">{c.source || '-'}</span>
                  </div>
                  <div className="fl-info-box">
                    <span className="fl-info-label">STAGE</span>
                    <span className="fl-info-value">
                      <select className="bk-inline-select"
                        value={c.current_status}
                        onChange={(e) => handleInlineStatus(c.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}>
                        {pipelineStatuses.map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </span>
                  </div>
                  <div className="fl-info-box">
                    <span className="fl-info-label">CALLS</span>
                    <span className="fl-info-value">
                      <span className="fl-calls-badge">{c.call_count || 0} CALLS</span>
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="fl-card-actions">
                  <button className="fl-action-btn" onClick={() => navigate(`/candidates/${c.id}`)} title="View Details">
                    <i className="bi bi-eye"></i> Details
                  </button>
                  <button className="fl-action-btn" onClick={() => setStatusCandidate(c)} title="Edit Status">
                    <i className="bi bi-pencil"></i> Edit
                  </button>
                  <button className="fl-action-btn" onClick={() => setBookCandidate(c)} title="Book Interview">
                    <i className="bi bi-bookmark-plus"></i> Book
                  </button>
                  <button className="fl-action-btn" onClick={() => navigate(`/candidates/${c.id}`)} title="Timeline">
                    <i className="bi bi-clock-history"></i> Timeline
                  </button>
                  <button className="fl-action-btn"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    title={isExpanded ? 'Collapse' : 'More'}>
                    <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`}></i> {isExpanded ? 'Less' : 'More'}
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="fl-card-expanded">
                    <div className="fl-card-info-grid" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                      <div className="fl-info-box">
                        <span className="fl-info-label">RECRUITER</span>
                        <span className="fl-info-value">{c.assigned_recruiter_name || 'Unassigned'}</span>
                      </div>
                      <div className="fl-info-box">
                        <span className="fl-info-label">ALT. PHONE</span>
                        <span className="fl-info-value">{c.alternate_phone || '-'}</span>
                      </div>
                      <div className="fl-info-box">
                        <span className="fl-info-label">TRAINER</span>
                        <span className="fl-info-value">{c.assigned_trainer_name || 'Unassigned'}</span>
                      </div>
                      <div className="fl-info-box">
                        <span className="fl-info-label">FOLLOW-UP</span>
                        <span className="fl-info-value">{formatDate(c.follow_up_date)}</span>
                      </div>
                      <div className="fl-info-box">
                        <span className="fl-info-label">CREATED</span>
                        <span className="fl-info-value">{formatDate(c.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Pagination */}
      {!loading && count > 0 && (
        <div className="fl-controls fl-controls-bottom">
          <span className="fl-showing">
            Showing <strong>{startIdx}&ndash;{endIdx}</strong> of <strong>{count}</strong> server-filtered candidates
          </span>
          <div className="fl-pagination-btns">
            <button className="fl-page-btn" disabled={page <= 1} onClick={() => setPage(1)}>First</button>
            <button className="fl-page-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span className="fl-page-num">Page {page}</span>
            <button className="fl-page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            <button className="fl-page-btn" onClick={handleRefresh}>Refresh</button>
          </div>
        </div>
      )}

      <StatusUpdateModal candidate={statusCandidate}
        onClose={() => setStatusCandidate(null)}
        onUpdated={() => { loadCandidates(); loadSummary(); }} />

      <BookCandidateModal
        show={!!bookCandidate}
        onClose={() => setBookCandidate(null)}
        candidate={bookCandidate}
        onBooked={() => { loadCandidates(); loadSummary(); }}
      />
    </div>
  );
}
