import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidatesAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import StatusUpdateModal from '../components/common/StatusUpdateModal';
import { STATUS_LABELS, getStatusBadgeClass } from '../utils/statusHelpers';
import ClickToCallButton from '../components/candidates/ClickToCallButton';
import BulkActionToolbar from '../components/candidates/BulkActionToolbar';

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

const TERMINAL_STATUSES = ['not_interested', 'wrong_number', 'invalid_contact', 'duplicate', 'do_not_contact'];

const ROWS_OPTIONS = [20, 50, 100];
const SORT_OPTIONS = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'created_at', label: 'Oldest first' },
  { value: 'first_name', label: 'Name A-Z' },
  { value: '-first_name', label: 'Name Z-A' },
];

const freshStatuses = [
  'never_contacted', 'contacted', 'unanswered', 'not_interested',
  'asked_to_connect_later', 'wrong_number', 'invalid_contact',
  'duplicate', 'do_not_contact', 'follow_up_due', 'interested',
];

export default function FreshCandidatesPage() {
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
  const [summary, setSummary] = useState({
    total: 0, never_contacted: 0, contacted: 0, unanswered: 0,
    not_interested: 0, callback: 0, closed: 0, interested: 0,
  });
  const [convertingId, setConvertingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

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
      const { data } = await candidatesAPI.fresh(params);
      setCandidates(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      setError('Failed to load candidates.');
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
      const { data } = await candidatesAPI.freshSummary(params);
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

  const handleConvert = async (candidate) => {
    if (convertingId) return;
    setConvertingId(candidate.id);
    try {
      await candidatesAPI.updateStatus(candidate.id, {
        status: 'interested',
        remarks: 'Converted to pipeline',
        is_admin_override: false,
      });
      loadCandidates();
      loadSummary();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to convert candidate.');
    } finally {
      setConvertingId(null);
    }
  };

  const handleRefresh = () => {
    loadCandidates();
    loadSummary();
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map(c => c.id));
    }
  };

  const handleBulkComplete = () => {
    setSelectedIds([]);
    loadCandidates();
    loadSummary();
  };

  const startIdx = (page - 1) * rowsPerPage + 1;
  const endIdx = Math.min(page * rowsPerPage, count);

  const summaryCards = [
    { label: 'TOTAL', value: summary.total, key: '' },
    { label: 'NEVER CONTACTED', value: summary.never_contacted, key: 'never_contacted' },
    { label: 'CONTACTED', value: summary.contacted, key: 'contacted' },
    { label: 'UNANSWERED', value: summary.unanswered, key: 'unanswered' },
    { label: 'CALLBACK', value: summary.callback, key: '_callback' },
    { label: 'NOT INTERESTED', value: summary.not_interested, key: 'not_interested' },
    { label: 'CLOSED', value: summary.closed, key: '_closed' },
    { label: 'INTERESTED', value: summary.interested, key: 'interested' },
  ];

  const handleCardClick = (card) => {
    if (card.key === '') {
      setStatusFilter('');
    } else if (card.key === '_callback') {
      setStatusFilter('follow_up_due');
    } else if (card.key === '_closed') {
      setStatusFilter('wrong_number');
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
        <h1 className="fl-title">Leads / Master Data</h1>
        <p className="fl-subtitle">Recruiter calling and lead qualification</p>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      {/* Master Data Section */}
      <div className="fl-master-section">
        <div className="fl-master-header">
          <div>
            <h2 className="fl-master-title">Master Data</h2>
            <p className="fl-master-sub">Server-side filtered lead pool &mdash; <strong>{count}</strong> matched</p>
          </div>
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            onClick={() => navigate('/candidates/upload')}>
            <i className="bi bi-cloud-arrow-up"></i> Upload CSV/XLSX
          </button>
        </div>

        {/* Filters */}
        <form onSubmit={handleSearch} className="fl-filters">
          <input type="text" className="fl-filter-input" placeholder="Search name, email, phone..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="fl-filter-select" value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {freshStatuses.map((s) => (
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
        <div className="d-flex align-items-center gap-2">
          <input type="checkbox" className="form-check-input"
            checked={candidates.length > 0 && selectedIds.length === candidates.length}
            onChange={toggleSelectAll} title="Select all" />
          <span className="fl-showing">
          Showing <strong>{count > 0 ? startIdx : 0}&ndash;{endIdx}</strong> of <strong>{count}</strong> server-filtered leads
        </span>
        </div>
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

      <BulkActionToolbar selectedIds={selectedIds} onComplete={handleBulkComplete} bucket="fresh" />

      {/* Candidate Cards */}
      {loading ? <LoadingSpinner /> : (
        <div className="fl-cards">
          {candidates.length === 0 ? (
            <div className="fl-empty">
              <i className="bi bi-inbox"></i>
              <p>No candidates found.</p>
            </div>
          ) : candidates.map((c) => {
            const initial = (c.first_name || '?')[0].toUpperCase();
            const color = getAvatarColor(c.first_name);
            const isTerminal = TERMINAL_STATUSES.includes(c.current_status);
            return (
              <div key={c.id} className="fl-card">
                {/* Card Header */}
                <div className="fl-card-header">
                  <input type="checkbox" className="form-check-input bulk-check"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleSelect(c.id)} />
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
                    <span className="fl-info-label">STATUS</span>
                    <span className="fl-info-value">
                      <span className={getStatusBadgeClass(c.current_status)}>
                        {STATUS_LABELS[c.current_status] || c.current_status}
                      </span>
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
                  <button className="fl-action-btn" onClick={() => setStatusCandidate(c)} title="Edit Status">
                    <i className="bi bi-pencil"></i> Edit
                  </button>
                  <a href={`tel:${c.phone}`} className="fl-action-btn" title="Call">
                    <i className="bi bi-telephone"></i> Call
                  </a>
                  {isTerminal ? (
                    <span className="fl-closed-badge">Closed</span>
                  ) : (
                    <button className="fl-action-btn"
                      onClick={() => handleConvert(c)}
                      disabled={convertingId === c.id || c.current_status === 'interested'}
                      title="Convert to Pipeline">
                      {convertingId === c.id ? 'Converting...' : 'Convert'}
                    </button>
                  )}
                  <button className="fl-action-btn" onClick={() => navigate(`/candidates/${c.id}`)} title="View Details">
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Pagination */}
      {!loading && count > 0 && (
        <div className="fl-controls fl-controls-bottom">
          <span className="fl-showing">
            Showing <strong>{startIdx}&ndash;{endIdx}</strong> of <strong>{count}</strong> server-filtered leads
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
    </div>
  );
}
