import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { STATUS_LABELS, formatDate } from '../utils/statusHelpers';

const REPORTS = [
  { key: 'recruiterWise', label: 'Recruiter Wise' },
  { key: 'contactedVsUncontacted', label: 'Contacted vs Uncontacted' },
  { key: 'freshToPipeline', label: 'Fresh to Pipeline' },
  { key: 'negativeBreakdown', label: 'Negative Breakdown' },
  { key: 'followUpPending', label: 'Follow-up Pending' },
  { key: 'pipelineStages', label: 'Pipeline Stages' },
  { key: 'uploadBatchSummary', label: 'Upload Batch Summary' },
  { key: 'duplicates', label: 'Duplicate Report' },
  { key: 'dailyTrends', label: 'Daily Trends' },
  { key: 'recruiterProductivity', label: 'Recruiter Productivity' },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('recruiterWise');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadReport(); }, [activeReport]);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const { data: result } = await reportsAPI[activeReport]();
      setData(result);
    } catch (err) {
      setError('Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const { data: blob } = await reportsAPI.exportCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'candidates_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Export failed.');
    }
  };

  const renderReport = () => {
    if (!data) return null;

    switch (activeReport) {
      case 'recruiterWise':
        return (
          <table className="table table-sm">
            <thead><tr><th>Recruiter</th><th className="text-end">Total</th><th className="text-end">Fresh</th><th className="text-end">Pipeline</th><th className="text-end">Contacted</th><th className="text-end">Never Contacted</th></tr></thead>
            <tbody>
              {(Array.isArray(data) ? data : []).map((r, i) => (
                <tr key={i}>
                  <td>{r.assigned_recruiter__first_name} {r.assigned_recruiter__last_name}</td>
                  <td className="text-end">{r.total}</td>
                  <td className="text-end">{r.fresh}</td>
                  <td className="text-end">{r.pipeline}</td>
                  <td className="text-end">{r.contacted}</td>
                  <td className="text-end">{r.never_contacted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'contactedVsUncontacted':
        return (
          <div className="row g-3">
            <div className="col-md-4"><div className="stat-card text-center"><div className="stat-value">{data.total}</div><div className="stat-label">Total</div></div></div>
            <div className="col-md-4"><div className="stat-card text-center"><div className="stat-value text-success">{data.contacted}</div><div className="stat-label">Contacted</div></div></div>
            <div className="col-md-4"><div className="stat-card text-center"><div className="stat-value text-warning">{data.uncontacted}</div><div className="stat-label">Uncontacted</div></div></div>
          </div>
        );

      case 'freshToPipeline':
        return (
          <div className="row g-3">
            <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value">{data.fresh_total}</div><div className="stat-label">Fresh</div></div></div>
            <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value">{data.pipeline_total}</div><div className="stat-label">Pipeline</div></div></div>
            <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value">{data.conversions}</div><div className="stat-label">Conversions</div></div></div>
            <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value">{data.conversion_rate}%</div><div className="stat-label">Rate</div></div></div>
          </div>
        );

      case 'negativeBreakdown':
        return (
          <table className="table table-sm">
            <thead><tr><th>Status</th><th className="text-end">Count</th></tr></thead>
            <tbody>
              {(Array.isArray(data) ? data : []).map((item, i) => (
                <tr key={i}>
                  <td>{STATUS_LABELS[item.current_status] || item.current_status}</td>
                  <td className="text-end">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'followUpPending':
        return (
          <table className="table table-sm">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Follow-up Date</th><th>Status</th></tr></thead>
            <tbody>
              {(Array.isArray(data) ? data : []).map((c) => (
                <tr key={c.id}>
                  <td>{c.first_name} {c.last_name}</td>
                  <td>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{formatDate(c.follow_up_date)}</td>
                  <td>{STATUS_LABELS[c.current_status] || c.current_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'pipelineStages':
        return (
          <table className="table table-sm">
            <thead><tr><th>Stage</th><th className="text-end">Count</th></tr></thead>
            <tbody>
              {(Array.isArray(data) ? data : []).map((item, i) => (
                <tr key={i}>
                  <td>{STATUS_LABELS[item.current_status] || item.current_status}</td>
                  <td className="text-end">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'uploadBatchSummary':
        return (
          <table className="table table-sm">
            <thead><tr><th>#</th><th>File</th><th>By</th><th>Total</th><th>Imported</th><th>Duplicates</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {(Array.isArray(data) ? data : []).map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.file_name}</td>
                  <td>{b.uploaded_by_name}</td>
                  <td>{b.total_rows}</td>
                  <td>{b.imported_count}</td>
                  <td>{b.duplicate_count}</td>
                  <td>{b.status}</td>
                  <td>{formatDate(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'duplicates':
        return (
          <div>
            <div className="row g-3 mb-4">
              <div className="col-md-6"><div className="stat-card text-center"><div className="stat-value">{data.duplicate_email_groups}</div><div className="stat-label">Duplicate Groups</div></div></div>
              <div className="col-md-6"><div className="stat-card text-center"><div className="stat-value">{data.total_duplicate_records}</div><div className="stat-label">Total Duplicates</div></div></div>
            </div>
            {data.details && (
              <table className="table table-sm">
                <thead><tr><th>Email</th><th className="text-end">Count</th></tr></thead>
                <tbody>
                  {data.details.map((d, i) => (
                    <tr key={i}><td>{d.email}</td><td className="text-end">{d.cnt}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );

      case 'dailyTrends':
        return (
          <table className="table table-sm">
            <thead><tr><th>Date</th><th className="text-end">Candidates Added</th></tr></thead>
            <tbody>
              {(Array.isArray(data) ? data : []).map((item, i) => (
                <tr key={i}><td>{formatDate(item.date)}</td><td className="text-end">{item.count}</td></tr>
              ))}
            </tbody>
          </table>
        );

      case 'recruiterProductivity':
        return (
          <table className="table table-sm">
            <thead><tr><th>Recruiter</th><th className="text-end">Total Actions</th><th className="text-end">Status Changes</th></tr></thead>
            <tbody>
              {(Array.isArray(data) ? data : []).map((r, i) => (
                <tr key={i}>
                  <td>{r.performed_by__first_name} {r.performed_by__last_name}</td>
                  <td className="text-end">{r.total_actions}</td>
                  <td className="text-end">{r.status_changes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      default:
        return <pre>{JSON.stringify(data, null, 2)}</pre>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
        <button className="btn btn-outline-primary btn-sm" onClick={handleExportCSV}>Export All CSV</button>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="row">
        <div className="col-md-3">
          <div className="table-container">
            <div className="list-group list-group-flush">
              {REPORTS.map((r) => (
                <button
                  key={r.key}
                  className={`list-group-item list-group-item-action ${activeReport === r.key ? 'active' : ''}`}
                  onClick={() => setActiveReport(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="col-md-9">
          <div className="table-container p-3">
            <h5 className="mb-3">{REPORTS.find((r) => r.key === activeReport)?.label}</h5>
            {loading ? <LoadingSpinner /> : renderReport()}
          </div>
        </div>
      </div>
    </div>
  );
}
