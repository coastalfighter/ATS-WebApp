import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { STATUS_LABELS, formatDateTime } from '../utils/statusHelpers';

function ProgressRing({ value, size = 56, stroke = 5 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none"
        stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={radius} fill="none"
        stroke="var(--primary)" strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
}

function HorizontalBar({ items, labelKey, valueKey, colorVar }) {
  if (!items || items.length === 0) return null;
  const max = Math.max(...items.map(i => i[valueKey] || 0), 1);
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="d-flex align-items-center gap-2 mb-2">
          <div style={{ width: '120px', fontSize: '0.78rem', textAlign: 'right' }} className="text-truncate text-muted">
            {typeof labelKey === 'function' ? labelKey(item) : item[labelKey]}
          </div>
          <div className="flex-grow-1">
            <div style={{
              height: '20px', borderRadius: '4px',
              width: `${Math.max(((item[valueKey] || 0) / max) * 100, 3)}%`,
              background: colorVar || 'var(--primary)',
              transition: 'width 0.4s ease',
              display: 'flex', alignItems: 'center', paddingLeft: '6px',
              color: '#fff', fontSize: '0.72rem', fontWeight: 600,
            }}>
              {item[valueKey]}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user, isAdminOrSubadmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const endpoint = isAdminOrSubadmin ? dashboardAPI.admin : dashboardAPI.recruiter;
      const { data: result } = await endpoint();
      setData(result);
    } catch (err) {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage message={error} />;

  const totalCandidates = data?.total_candidates || 0;
  const freshCount = data?.fresh_count || 0;
  const pipelineCount = data?.pipeline_count || 0;
  const conversionRate = totalCandidates > 0 ? Math.round((pipelineCount / totalCandidates) * 100) : 0;

  return (
    <div>
      {/* Hero Banner */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <h2>Welcome back, {user?.first_name || user?.username}</h2>
          <p>Here's what's happening across your pipeline today.</p>
          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-light btn-sm" onClick={() => navigate('/candidates/upload')}>
              <i className="bi bi-cloud-arrow-up me-1"></i> Import Candidates
            </button>
            <button className="btn btn-outline-light btn-sm" onClick={() => navigate('/candidates/fresh')}>
              <i className="bi bi-person-lines-fill me-1"></i> View Fresh
            </button>
          </div>
        </div>
        <div className="dashboard-hero-decoration">
          <div className="hero-circle hero-circle-1"></div>
          <div className="hero-circle hero-circle-2"></div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        {isAdminOrSubadmin ? (
          <>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-primary cursor-pointer" onClick={() => navigate('/candidates/fresh')}>
                <div className="stat-icon primary"><i className="bi bi-person-plus-fill"></i></div>
                <div className="stat-value">{freshCount}</div>
                <div className="stat-label">Fresh Candidates</div>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-success cursor-pointer" onClick={() => navigate('/candidates/pipeline')}>
                <div className="stat-icon success"><i className="bi bi-funnel-fill"></i></div>
                <div className="stat-value">{pipelineCount}</div>
                <div className="stat-label">Pipeline</div>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-info cursor-pointer" onClick={() => navigate('/candidates/all')}>
                <div className="stat-icon info"><i className="bi bi-people-fill"></i></div>
                <div className="stat-value">{totalCandidates}</div>
                <div className="stat-label">Total Candidates</div>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-warning cursor-pointer" onClick={() => navigate('/interviews')}>
                <div className="stat-icon warning"><i className="bi bi-camera-video-fill"></i></div>
                <div className="stat-value">{data?.upcoming_interviews_count || 0}</div>
                <div className="stat-label">Upcoming Interviews</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-primary cursor-pointer" onClick={() => navigate('/candidates/fresh')}>
                <div className="stat-icon primary"><i className="bi bi-person-plus-fill"></i></div>
                <div className="stat-value">{freshCount}</div>
                <div className="stat-label">Fresh Assigned</div>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-success cursor-pointer" onClick={() => navigate('/candidates/pipeline')}>
                <div className="stat-icon success"><i className="bi bi-funnel-fill"></i></div>
                <div className="stat-value">{pipelineCount}</div>
                <div className="stat-label">In Pipeline</div>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-danger">
                <div className="stat-icon danger"><i className="bi bi-telephone-x-fill"></i></div>
                <div className="stat-value">{data?.never_contacted || 0}</div>
                <div className="stat-label">Never Contacted</div>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-warning">
                <div className="stat-icon warning"><i className="bi bi-clock-fill"></i></div>
                <div className="stat-value">{data?.follow_ups_due || 0}</div>
                <div className="stat-label">Follow-ups Due</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Conversion Rate + Charts */}
      {isAdminOrSubadmin && (
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="table-container p-3 text-center">
              <div className="d-flex justify-content-center mb-2">
                <div style={{ position: 'relative' }}>
                  <ProgressRing value={conversionRate} size={80} stroke={6} />
                  <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(0deg)', fontWeight:700, fontSize:'1.1rem', color:'var(--primary)' }}>
                    {conversionRate}%
                  </div>
                </div>
              </div>
              <div className="stat-label">Pipeline Conversion</div>
              <small className="text-muted">{pipelineCount} of {totalCandidates}</small>
            </div>
          </div>
          {data?.status_breakdown && (
            <div className="col-md-4">
              <div className="table-container">
                <div className="p-3 border-bottom d-flex align-items-center gap-2">
                  <i className="bi bi-pie-chart-fill" style={{ color: 'var(--primary)' }}></i>
                  <h6 className="mb-0">Status Breakdown</h6>
                </div>
                <div className="p-3">
                  <HorizontalBar
                    items={data.status_breakdown.slice(0, 8)}
                    labelKey={(i) => STATUS_LABELS[i.current_status] || i.current_status}
                    valueKey="count"
                    colorVar="var(--primary)"
                  />
                </div>
              </div>
            </div>
          )}
          <div className="col-md-5">
            <div className="table-container">
              <div className="p-3 border-bottom d-flex align-items-center gap-2">
                <i className="bi bi-person-badge-fill" style={{ color: 'var(--primary)' }}></i>
                <h6 className="mb-0">Recruiter Stats</h6>
              </div>
              <div className="p-3">
                <HorizontalBar
                  items={data?.recruiter_stats || []}
                  labelKey={(r) => `${r.assigned_recruiter__first_name || ''} ${r.assigned_recruiter__last_name || ''}`}
                  valueKey="total"
                  colorVar="#6366f1"
                />
              </div>
              <table className="table table-sm mb-0">
                <thead><tr><th>Recruiter</th><th className="text-end">Total</th><th className="text-end">Fresh</th><th className="text-end">Pipeline</th></tr></thead>
                <tbody>
                  {(data?.recruiter_stats || []).map((r, i) => (
                    <tr key={i}>
                      <td><small>{r.assigned_recruiter__first_name} {r.assigned_recruiter__last_name}</small></td>
                      <td className="text-end"><small>{r.total}</small></td>
                      <td className="text-end"><small>{r.fresh}</small></td>
                      <td className="text-end"><small>{r.pipeline}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {data?.recent_activity && data.recent_activity.length > 0 && (
        <div className="table-container">
          <div className="p-3 border-bottom d-flex align-items-center gap-2">
            <i className="bi bi-activity" style={{ color: 'var(--primary)' }}></i>
            <h6 className="mb-0">Recent Activity</h6>
          </div>
          <table className="table table-sm">
            <thead><tr><th>Action</th><th>Details</th><th>By</th><th>Time</th></tr></thead>
            <tbody>
              {data.recent_activity.map((log) => (
                <tr key={log.id}>
                  <td className="text-capitalize">{log.action_type.replace(/_/g, ' ')}</td>
                  <td>{log.new_value || log.remarks || '-'}</td>
                  <td>{log.performed_by_name || '-'}</td>
                  <td>{formatDateTime(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
