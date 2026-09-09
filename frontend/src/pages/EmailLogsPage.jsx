import { useState, useEffect } from 'react';
import { interviewsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';
import { formatDateTime } from '../utils/statusHelpers';

export default function EmailLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadLogs(); }, [page, statusFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = { page };
      if (statusFilter) params.status = statusFilter;
      const { data } = await interviewsAPI.emailLogs(params);
      setLogs(data.results || data || []);
      setTotalPages(Math.ceil((data.count || 0) / 25));
    } catch (err) {
      setError('Failed to load email logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Email Logs</h1>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="filter-bar mb-3">
        <div className="row g-2">
          <div className="col-md-3">
            <select className="form-select form-select-sm" value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
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
                  <th>Sent At</th>
                  <th>Recipient</th>
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan="6" className="text-center text-muted py-4">No email logs found.</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id}>
                    <td><small style={{fontFamily:'monospace'}}>{formatDateTime(log.created_at || log.sent_at)}</small></td>
                    <td><small>{log.recipient}</small></td>
                    <td>
                      <span className="badge bg-secondary" style={{fontSize:'0.7rem'}}>
                        {(log.email_type || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td><small>{log.subject}</small></td>
                    <td>
                      <span className={`badge bg-${log.status === 'sent' ? 'success' : 'danger'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td><small className="text-danger">{log.error_message || '-'}</small></td>
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
