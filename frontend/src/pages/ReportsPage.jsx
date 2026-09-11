import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { STATUS_LABELS, formatDate } from '../utils/statusHelpers';

const REPORTS = [
  { key: 'recruiterWise', label: 'Recruiter Wise', icon: 'bi-person-badge' },
  { key: 'contactedVsUncontacted', label: 'Contacted vs Uncontacted', icon: 'bi-telephone' },
  { key: 'freshToPipeline', label: 'Fresh to Pipeline', icon: 'bi-arrow-right-circle' },
  { key: 'negativeBreakdown', label: 'Negative Breakdown', icon: 'bi-x-octagon' },
  { key: 'followUpPending', label: 'Follow-up Pending', icon: 'bi-clock' },
  { key: 'pipelineStages', label: 'Pipeline Stages', icon: 'bi-funnel' },
  { key: 'uploadBatchSummary', label: 'Upload Batch Summary', icon: 'bi-cloud-arrow-up' },
  { key: 'duplicates', label: 'Duplicate Report', icon: 'bi-files' },
  { key: 'dailyTrends', label: 'Daily Trends', icon: 'bi-graph-up' },
  { key: 'recruiterProductivity', label: 'Recruiter Productivity', icon: 'bi-speedometer2' },
  { key: 'kpiAttainment', label: 'KPI Attainment', icon: 'bi-bullseye' },
  { key: 'bookingSummary', label: 'Booking Analytics', icon: 'bi-calendar-check' },
  { key: 'round2Summary', label: 'Round 2 Analytics', icon: 'bi-clipboard-data' },
  { key: 'recruiterLeaderboard', label: 'KPI Leaderboard', icon: 'bi-trophy' },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('recruiterWise');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { loadReport(); }, [activeReport]);

  const [leaderboardPeriod, setLeaderboardPeriod] = useState('daily');

  const loadReport = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const params = {};
      if (['dailyTrends', 'recruiterProductivity'].includes(activeReport)) {
        params.days = days;
      }
      if (activeReport === 'recruiterLeaderboard') {
        params.period = leaderboardPeriod;
      }
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const { data: result } = await reportsAPI[activeReport](params);
      setData(result);
    } catch (err) {
      setError('Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const { data: blob } = await reportsAPI.exportCSV(params);
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

  const renderBarChart = (items, labelKey, valueKey, maxVal) => {
    if (!items || items.length === 0) return null;
    const max = maxVal || Math.max(...items.map(i => i[valueKey] || 0), 1);
    return (
      <div className="mb-3">
        {items.map((item, i) => (
          <div key={i} className="d-flex align-items-center gap-2 mb-2">
            <div style={{ width: '140px', fontSize: '0.8rem', textAlign: 'right' }} className="text-truncate">
              {typeof labelKey === 'function' ? labelKey(item) : item[labelKey]}
            </div>
            <div className="flex-grow-1">
              <div style={{
                height: '22px', borderRadius: '4px',
                width: `${Math.max((item[valueKey] / max) * 100, 2)}%`,
                background: 'var(--primary)', transition: 'width 0.3s',
                display: 'flex', alignItems: 'center', paddingLeft: '6px',
                color: '#fff', fontSize: '0.75rem', fontWeight: 500
              }}>
                {item[valueKey]}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderReport = () => {
    if (!data) return null;

    switch (activeReport) {
      case 'recruiterWise':
        return (
          <div>
            {renderBarChart(
              Array.isArray(data) ? data : [],
              (r) => `${r.assigned_recruiter__first_name || ''} ${r.assigned_recruiter__last_name || ''}`,
              'total'
            )}
            <table className="table table-sm mt-3">
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
          </div>
        );

      case 'contactedVsUncontacted':
        return (
          <div>
            <div className="row g-3 mb-3">
              <div className="col-md-4"><div className="stat-card text-center"><div className="stat-value">{data.total}</div><div className="stat-label">Total</div></div></div>
              <div className="col-md-4"><div className="stat-card text-center"><div className="stat-value text-success">{data.contacted}</div><div className="stat-label">Contacted</div></div></div>
              <div className="col-md-4"><div className="stat-card text-center"><div className="stat-value text-warning">{data.uncontacted}</div><div className="stat-label">Uncontacted</div></div></div>
            </div>
            {data.total > 0 && (
              <div className="d-flex gap-1" style={{ height: '30px', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${(data.contacted / data.total) * 100}%`, background: 'var(--success, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem' }}>
                  {Math.round((data.contacted / data.total) * 100)}%
                </div>
                <div style={{ width: `${(data.uncontacted / data.total) * 100}%`, background: 'var(--warning, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem' }}>
                  {Math.round((data.uncontacted / data.total) * 100)}%
                </div>
              </div>
            )}
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
          <div>
            {renderBarChart(Array.isArray(data) ? data : [], (i) => STATUS_LABELS[i.current_status] || i.current_status, 'count')}
            <table className="table table-sm mt-3">
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
          </div>
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
          <div>
            {renderBarChart(Array.isArray(data) ? data : [], (i) => STATUS_LABELS[i.current_status] || i.current_status, 'count')}
            <table className="table table-sm mt-3">
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
          </div>
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
          <div>
            {renderBarChart(Array.isArray(data) ? data : [], (i) => formatDate(i.date), 'count')}
            <table className="table table-sm mt-3">
              <thead><tr><th>Date</th><th className="text-end">Candidates Added</th></tr></thead>
              <tbody>
                {(Array.isArray(data) ? data : []).map((item, i) => (
                  <tr key={i}><td>{formatDate(item.date)}</td><td className="text-end">{item.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'recruiterProductivity':
        return (
          <div>
            {renderBarChart(
              Array.isArray(data) ? data : [],
              (r) => `${r.performed_by__first_name || ''} ${r.performed_by__last_name || ''}`,
              'total_actions'
            )}
            <table className="table table-sm mt-3">
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
          </div>
        );

      case 'kpiAttainment':
        return (
          <div>
            <table className="table table-sm">
              <thead><tr><th>Recruiter</th><th className="text-end">Calls</th><th className="text-end">Target</th><th className="text-end">Attainment</th><th className="text-end">Bookings</th><th className="text-end">Target</th><th className="text-end">Attainment</th><th className="text-end">Status Changes</th></tr></thead>
              <tbody>
                {(Array.isArray(data) ? data : []).map((r) => (
                  <tr key={r.recruiter_id}>
                    <td>{r.recruiter_name}</td>
                    <td className="text-end">{r.calls_today}</td>
                    <td className="text-end">{r.call_target}</td>
                    <td className="text-end"><span className={`badge bg-${r.call_attainment >= 100 ? 'success' : r.call_attainment >= 50 ? 'primary' : 'warning'}`}>{r.call_attainment}%</span></td>
                    <td className="text-end">{r.bookings_today}</td>
                    <td className="text-end">{r.booking_target}</td>
                    <td className="text-end"><span className={`badge bg-${r.booking_attainment >= 100 ? 'success' : r.booking_attainment >= 50 ? 'primary' : 'warning'}`}>{r.booking_attainment}%</span></td>
                    <td className="text-end">{r.status_changes_today}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'bookingSummary':
        return (
          <div>
            <div className="row g-3 mb-4">
              <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value">{data.total_bookings}</div><div className="stat-label">Total Bookings</div></div></div>
              <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value text-success">{data.confirmed}</div><div className="stat-label">Confirmed</div></div></div>
              <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value text-danger">{data.cancelled}</div><div className="stat-label">Cancelled</div></div></div>
              <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value text-warning">{data.no_show}</div><div className="stat-label">No Show</div></div></div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-md-4"><div className="stat-card text-center"><div className="stat-value">{data.pipeline_total}</div><div className="stat-label">Pipeline Total</div></div></div>
              <div className="col-md-4"><div className="stat-card text-center"><div className="stat-value">{data.hired_total}</div><div className="stat-label">Hired</div></div></div>
              <div className="col-md-4"><div className="stat-card text-center"><div className="stat-value">{data.conversion_rate}%</div><div className="stat-label">Conversion Rate</div></div></div>
            </div>
            {data.by_location && data.by_location.length > 0 && (
              <>
                <h6 className="mt-3">Bookings by Location</h6>
                {renderBarChart(data.by_location, (i) => i.interview_slot__location__name || 'Unknown', 'count')}
              </>
            )}
          </div>
        );

      case 'round2Summary':
        return (
          <div>
            <div className="row g-3 mb-4">
              <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value">{data.round2_scheduled}</div><div className="stat-label">Scheduled</div></div></div>
              <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value text-success">{data.round2_completed}</div><div className="stat-label">Completed</div></div></div>
              <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value text-danger">{data.round2_rejected}</div><div className="stat-label">Rejected</div></div></div>
              <div className="col-md-3"><div className="stat-card text-center"><div className="stat-value">{data.pass_rate}%</div><div className="stat-label">Pass Rate</div></div></div>
            </div>
            <div className="row g-3 mb-4">
              <div className="col-md-6"><div className="stat-card text-center"><div className="stat-value">{data.avg_observation_score}</div><div className="stat-label">Avg Observation Score</div></div></div>
              <div className="col-md-6"><div className="stat-card text-center"><div className="stat-value">{data.total_observations}</div><div className="stat-label">Total Observations</div></div></div>
            </div>
            {data.trainer_stats && data.trainer_stats.length > 0 && (
              <table className="table table-sm mt-3">
                <thead><tr><th>Trainer</th><th className="text-end">Observations</th><th className="text-end">Avg Performance</th><th className="text-end">Avg Communication</th><th className="text-end">Avg Technical</th></tr></thead>
                <tbody>
                  {data.trainer_stats.map((t, i) => (
                    <tr key={i}>
                      <td>{t.trainer__first_name} {t.trainer__last_name}</td>
                      <td className="text-end">{t.total_observations}</td>
                      <td className="text-end">{(t.avg_performance || 0).toFixed(1)}</td>
                      <td className="text-end">{(t.avg_communication || 0).toFixed(1)}</td>
                      <td className="text-end">{(t.avg_technical || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );

      case 'recruiterLeaderboard':
        return (
          <div>
            {renderBarChart(Array.isArray(data) ? data : [], (r) => r.recruiter_name, 'score')}
            <table className="table table-sm mt-3">
              <thead><tr><th>#</th><th>Recruiter</th><th className="text-end">Calls</th><th className="text-end">Bookings</th><th className="text-end">Hires</th><th className="text-end">Status Changes</th><th className="text-end">Score</th></tr></thead>
              <tbody>
                {(Array.isArray(data) ? data : []).map((r) => (
                  <tr key={r.recruiter_id}>
                    <td><span className={`badge bg-${r.rank <= 3 ? 'warning' : 'secondary'}`}>{r.rank}</span></td>
                    <td className="fw-medium">{r.recruiter_name}</td>
                    <td className="text-end">{r.calls}</td>
                    <td className="text-end">{r.bookings}</td>
                    <td className="text-end">{r.hires}</td>
                    <td className="text-end">{r.status_changes}</td>
                    <td className="text-end fw-bold">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return <pre>{JSON.stringify(data, null, 2)}</pre>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
        <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1" onClick={handleExportCSV}>
          <i className="bi bi-download"></i> Export All CSV
        </button>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="row">
        <div className="col-md-3">
          <div className="table-container mb-3">
            <div className="list-group list-group-flush">
              {REPORTS.map((r) => (
                <button
                  key={r.key}
                  className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${activeReport === r.key ? 'active' : ''}`}
                  onClick={() => setActiveReport(r.key)}
                >
                  <i className={`bi ${r.icon}`}></i> {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="col-md-9">
          <div className="table-container p-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">{REPORTS.find((r) => r.key === activeReport)?.label}</h5>
            </div>
            <div className="row g-2 mb-3">
              {['dailyTrends', 'recruiterProductivity'].includes(activeReport) && (
                <div className="col-md-2">
                  <select className="form-select form-select-sm" value={days}
                    onChange={(e) => setDays(parseInt(e.target.value))}>
                    <option value="7">Last 7 days</option>
                    <option value="14">Last 14 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="60">Last 60 days</option>
                    <option value="90">Last 90 days</option>
                  </select>
                </div>
              )}
              {activeReport === 'recruiterLeaderboard' && (
                <div className="col-md-2">
                  <select className="form-select form-select-sm" value={leaderboardPeriod}
                    onChange={(e) => setLeaderboardPeriod(e.target.value)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}
              <div className="col-md-2">
                <input type="date" className="form-control form-control-sm" placeholder="From"
                  value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="col-md-2">
                <input type="date" className="form-control form-control-sm" placeholder="To"
                  value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="col-md-2">
                <button className="btn btn-outline-primary btn-sm w-100" onClick={loadReport}>
                  <i className="bi bi-arrow-clockwise"></i> Apply
                </button>
              </div>
              {(dateFrom || dateTo) && (
                <div className="col-md-2">
                  <button className="btn btn-outline-secondary btn-sm w-100" onClick={() => { setDateFrom(''); setDateTo(''); setTimeout(loadReport, 0); }}>
                    <i className="bi bi-x-circle"></i> Clear
                  </button>
                </div>
              )}
            </div>
            {loading ? <LoadingSpinner /> : renderReport()}
          </div>
        </div>
      </div>
    </div>
  );
}
