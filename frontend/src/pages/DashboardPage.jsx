import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { STATUS_LABELS, formatDateTime } from '../utils/statusHelpers';

export default function DashboardPage() {
  const { user, isAdminOrSubadmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

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

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <span className="badge bg-primary text-capitalize" style={{ fontSize: '0.75rem', padding: '0.4em 0.8em' }}>{user?.role}</span>
      </div>

      <div className="row g-3 mb-4">
        {isAdminOrSubadmin ? (
          <>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-primary cursor-pointer" onClick={() => navigate('/candidates/fresh')}>
                <div className="stat-icon primary"><i className="bi bi-person-plus-fill"></i></div>
                <div className="stat-value">{data?.fresh_count || 0}</div>
                <div className="stat-label">Fresh Candidates</div>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-success cursor-pointer" onClick={() => navigate('/candidates/pipeline')}>
                <div className="stat-icon success"><i className="bi bi-funnel-fill"></i></div>
                <div className="stat-value">{data?.pipeline_count || 0}</div>
                <div className="stat-label">Pipeline</div>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-info">
                <div className="stat-icon info"><i className="bi bi-people-fill"></i></div>
                <div className="stat-value">{data?.total_candidates || 0}</div>
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
              <div className="stat-card stat-card-accent-primary">
                <div className="stat-icon primary"><i className="bi bi-person-plus-fill"></i></div>
                <div className="stat-value">{data?.fresh_count || 0}</div>
                <div className="stat-label">Fresh Assigned</div>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="stat-card stat-card-accent-success">
                <div className="stat-icon success"><i className="bi bi-funnel-fill"></i></div>
                <div className="stat-value">{data?.pipeline_count || 0}</div>
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

      {isAdminOrSubadmin && data?.status_breakdown && (
        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <div className="table-container">
              <div className="p-3 border-bottom d-flex align-items-center gap-2">
                <i className="bi bi-pie-chart-fill" style={{ color: 'var(--primary)' }}></i>
                <h6 className="mb-0">Status Breakdown</h6>
              </div>
              <table className="table table-sm">
                <thead><tr><th>Status</th><th className="text-end">Count</th></tr></thead>
                <tbody>
                  {data.status_breakdown.map((item, i) => (
                    <tr key={i}>
                      <td>{STATUS_LABELS[item.current_status] || item.current_status}</td>
                      <td className="text-end">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="col-md-6">
            <div className="table-container">
              <div className="p-3 border-bottom d-flex align-items-center gap-2">
                <i className="bi bi-person-badge-fill" style={{ color: 'var(--primary)' }}></i>
                <h6 className="mb-0">Recruiter Stats</h6>
              </div>
              <table className="table table-sm">
                <thead><tr><th>Recruiter</th><th className="text-end">Total</th><th className="text-end">Fresh</th><th className="text-end">Pipeline</th></tr></thead>
                <tbody>
                  {(data.recruiter_stats || []).map((r, i) => (
                    <tr key={i}>
                      <td>{r.assigned_recruiter__first_name} {r.assigned_recruiter__last_name}</td>
                      <td className="text-end">{r.total}</td>
                      <td className="text-end">{r.fresh}</td>
                      <td className="text-end">{r.pipeline}</td>
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
