import { useState, useEffect } from 'react';
import { callLogsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default function CallLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [providerFilter, setProviderFilter] = useState('');

  useEffect(() => { loadLogs(); }, [page, providerFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = { page };
      if (providerFilter) params.provider = providerFilter;
      const { data } = await callLogsAPI.list(params);
      setLogs(data.results || data || []);
      setTotalPages(Math.ceil((data.count || 0) / 25));
    } catch {
      setError('Failed to load call logs.');
    } finally {
      setLoading(false);
    }
  };

  const statusIcons = {
    completed: { icon: 'bi-telephone-fill', color: 'var(--success)' },
    missed: { icon: 'bi-telephone-x-fill', color: 'var(--danger)' },
    failed: { icon: 'bi-telephone-x-fill', color: 'var(--danger)' },
    no_answer: { icon: 'bi-telephone-minus-fill', color: 'var(--warning)' },
  };

  return (
    <div>
      <div className="page-header">
        <h1>Call Logs</h1>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="filter-bar mb-3">
        <div className="row g-2">
          <div className="col-md-3">
            <select className="form-select form-select-sm" value={providerFilter}
              onChange={e => { setProviderFilter(e.target.value); setPage(1); }}>
              <option value="">All Providers</option>
              <option value="ringcentral">RingCentral</option>
              <option value="manual">Manual</option>
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
                  <th>Time</th>
                  <th>Candidate</th>
                  <th>Phone</th>
                  <th>Direction</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Called By</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan="8" className="text-center text-muted py-4">No call logs found.</td></tr>
                ) : logs.map(log => {
                  const si = statusIcons[log.status] || statusIcons.completed;
                  return (
                    <tr key={log.id}>
                      <td><small style={{ fontFamily: 'monospace' }}>
                        {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </small></td>
                      <td><small className="fw-medium">{log.candidate_name || `#${log.candidate}`}</small></td>
                      <td><small style={{ fontFamily: 'monospace' }}>{log.phone_number}</small></td>
                      <td>
                        <span className="d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                          <i className={`bi bi-arrow-${log.direction === 'outbound' ? 'up-right' : 'down-left'}`}
                            style={{ color: log.direction === 'outbound' ? 'var(--primary)' : 'var(--success)' }}></i>
                          {log.direction}
                        </span>
                      </td>
                      <td><small>{formatDuration(log.duration_seconds)}</small></td>
                      <td>
                        <span className="d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                          <i className={`bi ${si.icon}`} style={{ color: si.color }}></i>
                          {log.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>
                          {log.provider}
                        </span>
                      </td>
                      <td><small>{log.initiated_by_name || '-'}</small></td>
                    </tr>
                  );
                })}
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
