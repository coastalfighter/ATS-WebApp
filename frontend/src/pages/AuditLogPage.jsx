import { useState, useEffect } from 'react';
import { candidatesAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';
import { formatDateTime } from '../utils/statusHelpers';

export default function AuditLogPage() {
  const [activeTab, setActiveTab] = useState('audit');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { loadLogs(); }, [page, activeTab]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = { page };
      if (actionFilter) params.action_type = actionFilter;
      if (userFilter) params.user_id = userFilter;
      if (dateFrom) params.created_after = dateFrom;
      if (dateTo) params.created_before = dateTo;
      const { data } = await candidatesAPI.activityLog(params);
      setLogs(data.results || data || []);
      setTotalPages(Math.ceil((data.count || 0) / 25));
    } catch (err) {
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    setPage(1);
    loadLogs();
  };

  const clearFilters = () => {
    setActionFilter('');
    setUserFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setTimeout(loadLogs, 0);
  };

  const actionTypes = [
    'candidate_created', 'candidate_imported', 'candidate_assigned',
    'status_changed', 'recruiter_changed', 'notes_updated',
    'calendar_event_created', 'email_sent', 'zoom_meeting_created',
    'follow_up_updated', 'candidate_edited', 'bucket_changed',
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Audit Log</h1>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => { setActiveTab('audit'); setPage(1); }}>
            <i className="bi bi-journal-text me-1"></i> Activity Log
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'lifecycle' ? 'active' : ''}`}
            onClick={() => { setActiveTab('lifecycle'); setActionFilter('status_changed'); setPage(1); }}>
            <i className="bi bi-arrow-left-right me-1"></i> Status Changes
          </button>
        </li>
      </ul>

      <div className="filter-bar mb-3">
        <div className="row g-2 align-items-end">
          {activeTab === 'audit' && (
            <div className="col-md-3">
              <label className="form-label small">Action Type</label>
              <select className="form-select form-select-sm" value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}>
                <option value="">All Actions</option>
                {actionTypes.map(a => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          )}
          <div className="col-md-2">
            <label className="form-label small">From</label>
            <input type="date" className="form-control form-control-sm"
              value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label small">To</label>
            <input type="date" className="form-control form-control-sm"
              value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="col-md-2">
            <button className="btn btn-outline-primary btn-sm w-100" onClick={handleApply}>
              <i className="bi bi-funnel"></i> Apply
            </button>
          </div>
          <div className="col-md-2">
            <button className="btn btn-outline-secondary btn-sm w-100" onClick={clearFilters}>
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
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  {activeTab === 'lifecycle' ? (
                    <>
                      <th>From</th>
                      <th>To</th>
                    </>
                  ) : (
                    <th>Details</th>
                  )}
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={activeTab === 'lifecycle' ? 6 : 5} className="text-center text-muted py-4">No audit entries found.</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id}>
                    <td><small style={{fontFamily:'monospace'}}>{formatDateTime(log.created_at)}</small></td>
                    <td><small>{log.performed_by_name || 'System'}</small></td>
                    <td>
                      <span className="badge bg-secondary" style={{fontFamily:'monospace', fontSize:'0.7rem'}}>
                        {log.action_type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    {activeTab === 'lifecycle' ? (
                      <>
                        <td><small style={{fontFamily:'monospace'}}>{log.old_value || '-'}</small></td>
                        <td><small style={{fontFamily:'monospace'}}>{log.new_value || '-'}</small></td>
                      </>
                    ) : (
                      <td><small>{log.new_value || log.old_value || '-'}</small></td>
                    )}
                    <td><small className="text-muted">{log.remarks || '-'}</small></td>
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
    </div>
  );
}
