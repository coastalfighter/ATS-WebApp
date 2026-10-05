import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, reportsAPI, locationsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { STATUS_LABELS, formatDateTime } from '../utils/statusHelpers';

function formatDateInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatSlotTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatSlotDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatChartLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function LineChart({ labels, data, color, title, subtitle }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const maxVal = Math.max(...data, 1);
    const gridSteps = 4;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridSteps; i++) {
      const y = pad.top + chartH - (i / gridSteps) * chartH;
      const val = Math.round((i / gridSteps) * maxVal);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText(val, pad.left - 8, y + 4);
    }

    ctx.textAlign = 'center';
    const formattedLabels = labels.map(formatChartLabel);
    formattedLabels.forEach((label, i) => {
      const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
      ctx.fillText(label, x, H - 8);
    });

    if (data.length > 1) {
      const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
      gradient.addColorStop(0, color + '30');
      gradient.addColorStop(1, color + '05');

      ctx.beginPath();
      data.forEach((val, i) => {
        const x = pad.left + (i / (data.length - 1)) * chartW;
        const y = pad.top + chartH - (val / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      const lastX = pad.left + chartW;
      const firstX = pad.left;
      ctx.lineTo(lastX, pad.top + chartH);
      ctx.lineTo(firstX, pad.top + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      data.forEach((val, i) => {
        const x = pad.left + (i / (data.length - 1)) * chartW;
        const y = pad.top + chartH - (val / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      data.forEach((val, i) => {
        const x = pad.left + (i / (data.length - 1)) * chartW;
        const y = pad.top + chartH - (val / maxVal) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
  }, [labels, data, color]);

  return (
    <div className="dash-chart-card">
      <div className="dash-chart-header">
        <h6 className="dash-chart-title">{title}</h6>
        <small className="text-muted">{subtitle}</small>
      </div>
      <div className="dash-chart-body">
        <canvas ref={canvasRef} style={{ width: '100%', height: '220px' }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isAdminOrSubadmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(formatDateInput(new Date(today.getTime() - 6 * 86400000)));
  const [dateTo, setDateTo] = useState(formatDateInput(today));
  const [appliedFrom, setAppliedFrom] = useState(dateFrom);
  const [appliedTo, setAppliedTo] = useState(dateTo);
  const [kpiData, setKpiData] = useState(null);
  const [goalsData, setGoalsData] = useState(null);
  const [goalsWeek, setGoalsWeek] = useState(() => {
    const t = new Date();
    const day = t.getDay();
    const mon = new Date(t);
    mon.setDate(t.getDate() - ((day + 6) % 7));
    return formatDateInput(mon);
  });
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalFormRows, setGoalFormRows] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [allRecruiters, setAllRecruiters] = useState([]);
  const [goalSaving, setGoalSaving] = useState(false);

  const loadDashboard = useCallback(async (from, to) => {
    setLoading(true);
    try {
      const endpoint = isAdminOrSubadmin ? dashboardAPI.admin : dashboardAPI.recruiter;
      const params = {};
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const { data: result } = await endpoint(params);
      setData(result);
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [isAdminOrSubadmin]);

  useEffect(() => { loadDashboard(appliedFrom, appliedTo); }, [loadDashboard, appliedFrom, appliedTo]);

  useEffect(() => {
    reportsAPI.kpiAttainment()
      .then(({ data: result }) => {
        if (!isAdminOrSubadmin) {
          const myKpi = result.find(r => String(r.recruiter_id) === String(user?.id));
          setKpiData(myKpi ? [myKpi] : []);
        } else {
          setKpiData(result);
        }
      })
      .catch(() => {});
  }, [user, isAdminOrSubadmin]);

  const loadBookingGoals = useCallback(async (weekStart) => {
    try {
      const { data: result } = await dashboardAPI.bookingGoals({ week_start: weekStart });
      setGoalsData(result);
    } catch { /* goals not available yet */ }
  }, []);

  useEffect(() => {
    if (isAdminOrSubadmin) loadBookingGoals(goalsWeek);
  }, [isAdminOrSubadmin, goalsWeek, loadBookingGoals]);

  const openGoalForm = async () => {
    try {
      const [locRes] = await Promise.all([locationsAPI.list()]);
      const locs = locRes.data.results || locRes.data || [];
      setAllLocations(locs);
      const recs = data?.recruiter_stats || [];
      setAllRecruiters(recs);
      if (goalsData && goalsData.goals.length > 0) {
        setGoalFormRows(goalsData.goals.map(g => ({
          location: g.location_id,
          recruiter: g.recruiter_id || '',
          goal: g.goal,
        })));
      } else {
        setGoalFormRows(locs.filter(l => l.is_active).map(l => ({
          location: l.id,
          recruiter: '',
          goal: 0,
        })));
      }
      setShowGoalForm(true);
    } catch { /* ignore */ }
  };

  const addGoalRow = () => {
    setGoalFormRows([...goalFormRows, { location: '', recruiter: '', goal: 0 }]);
  };

  const removeGoalRow = (idx) => {
    setGoalFormRows(goalFormRows.filter((_, i) => i !== idx));
  };

  const saveGoals = async () => {
    setGoalSaving(true);
    try {
      const payload = {
        week_start: goalsWeek,
        goals: goalFormRows.filter(r => r.location && r.goal > 0).map(r => ({
          location: String(r.location),
          recruiter: r.recruiter ? String(r.recruiter) : null,
          goal: parseInt(r.goal) || 0,
        })),
      };
      await dashboardAPI.setBookingGoals(payload);
      setShowGoalForm(false);
      loadBookingGoals(goalsWeek);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save goals.');
    }
    setGoalSaving(false);
  };

  const handleApply = () => {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
  };

  const setPreset = (days) => {
    const t = new Date();
    const from = new Date(t.getTime() - (days - 1) * 86400000);
    setDateFrom(formatDateInput(from));
    setDateTo(formatDateInput(t));
    setAppliedFrom(formatDateInput(from));
    setAppliedTo(formatDateInput(t));
  };

  if (loading && !data) return <LoadingSpinner />;

  const slot = data?.next_slot;

  return (
    <div>
      <AlertMessage message={error} onClose={() => setError('')} />

      {/* Header */}
      <div className="dash-header-section">
        <div>
          <span className="dash-ops-badge">HIRING OPERATIONS</span>
          <h1 className="dash-title">Dashboard</h1>
          <p className="dash-subtitle">Live ATS command center</p>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="dash-date-filter">
        <div className="dash-date-inputs">
          <div>
            <label className="dash-date-label">FROM</label>
            <input type="date" className="form-control form-control-sm"
              value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="dash-date-label">TO</label>
            <input type="date" className="form-control form-control-sm"
              value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="dash-date-actions">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setPreset(7)}>Last 7 Days</button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setPreset(30)}>Last 30 Days</button>
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={handleApply}>
            <i className="bi bi-arrow-clockwise"></i> Apply / Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      {isAdminOrSubadmin ? (
        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <div className="dash-stat-card cursor-pointer" onClick={() => navigate('/interviews')}>
              <div>
                <div className="dash-stat-label">BOOKINGS IN RANGE</div>
                <div className="dash-stat-value">{data?.bookings_in_range || 0}</div>
                <div className="dash-stat-sub">{appliedFrom} to {appliedTo}</div>
              </div>
              <div className="dash-stat-icon" style={{ background: '#4f46e510', color: '#4f46e5' }}>
                <i className="bi bi-calendar-check"></i>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="dash-stat-card cursor-pointer" onClick={() => navigate('/calendar')}>
              <div>
                <div className="dash-stat-label">NEXT SLOT</div>
                <div className="dash-stat-value">{slot ? '1' : '0'}</div>
                <div className="dash-stat-sub">
                  {slot
                    ? `${slot.applicant_count} applicants · ${formatSlotDate(slot.scheduled_at)} · ${formatSlotTime(slot.scheduled_at)} - ${formatSlotTime(slot.end_at)}`
                    : 'No upcoming slots'}
                </div>
              </div>
              <div className="dash-stat-icon" style={{ background: '#7c3aed10', color: '#7c3aed' }}>
                <i className="bi bi-clock-history"></i>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="dash-stat-card cursor-pointer" onClick={() => navigate('/candidates/all')}>
              <div>
                <div className="dash-stat-label">LEADS UPLOADED</div>
                <div className="dash-stat-value">{data?.leads_in_range || 0}</div>
                <div className="dash-stat-sub">Selected date range</div>
              </div>
              <div className="dash-stat-icon" style={{ background: '#05966910', color: '#059669' }}>
                <i className="bi bi-cloud-arrow-up"></i>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="dash-stat-card cursor-pointer" onClick={() => navigate('/call-logs')}>
              <div>
                <div className="dash-stat-label">CALLS IN RANGE</div>
                <div className="dash-stat-value">{data?.calls_in_range || 0}</div>
                <div className="dash-stat-sub">From call audit logs</div>
              </div>
              <div className="dash-stat-icon" style={{ background: '#d9770610', color: '#d97706' }}>
                <i className="bi bi-telephone"></i>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className={`dash-stat-card ${(data?.missing_zoom || 0) > 0 ? 'attention' : ''}`}>
              <div>
                <div className="dash-stat-label">MISSING ZOOM</div>
                <div className="dash-stat-value">{data?.missing_zoom || 0}</div>
                <div className="dash-stat-sub">{(data?.missing_zoom || 0) > 0 ? 'Needs attention' : 'All good'}</div>
              </div>
              <div className="dash-stat-icon" style={{ background: '#0891b210', color: '#0891b2' }}>
                <i className="bi bi-camera-video"></i>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="row g-3 mb-4">
          <div className="col-md-3 col-6">
            <div className="dash-stat-card cursor-pointer" onClick={() => navigate('/candidates/fresh')}>
              <div>
                <div className="dash-stat-label">FRESH ASSIGNED</div>
                <div className="dash-stat-value">{data?.fresh_count || 0}</div>
              </div>
              <div className="dash-stat-icon" style={{ background: '#4f46e510', color: '#4f46e5' }}>
                <i className="bi bi-person-plus"></i>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="dash-stat-card cursor-pointer" onClick={() => navigate('/candidates/pipeline')}>
              <div>
                <div className="dash-stat-label">IN PIPELINE</div>
                <div className="dash-stat-value">{data?.pipeline_count || 0}</div>
              </div>
              <div className="dash-stat-icon" style={{ background: '#05966910', color: '#059669' }}>
                <i className="bi bi-funnel"></i>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="dash-stat-card">
              <div>
                <div className="dash-stat-label">NEVER CONTACTED</div>
                <div className="dash-stat-value">{data?.never_contacted || 0}</div>
              </div>
              <div className="dash-stat-icon" style={{ background: '#dc262610', color: '#dc2626' }}>
                <i className="bi bi-telephone-x"></i>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="dash-stat-card">
              <div>
                <div className="dash-stat-label">FOLLOW-UPS DUE</div>
                <div className="dash-stat-value">{data?.follow_ups_due || 0}</div>
              </div>
              <div className="dash-stat-icon" style={{ background: '#d9770610', color: '#d97706' }}>
                <i className="bi bi-clock"></i>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next Interview Slot */}
      {isAdminOrSubadmin && slot && (
        <div className="dash-next-slot mb-4">
          <div className="dash-next-slot-header">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-clock-history" style={{ color: '#7c3aed', fontSize: '1.1rem' }}></i>
              <div>
                <h6 className="mb-0 fw-bold">Next Interview Slot</h6>
                <small className="text-muted">All upcoming interviews in the next available slot</small>
              </div>
            </div>
            <span className="badge" style={{ background: '#7c3aed15', color: '#7c3aed', fontSize: '0.75rem' }}>
              1 slot
            </span>
          </div>

          <div className="dash-next-slot-body">
            <div className="d-flex gap-2 mb-3 flex-wrap">
              <span className="dash-slot-pill">
                <i className="bi bi-clock me-1"></i>{formatSlotTime(slot.scheduled_at)}
              </span>
              <span className="dash-slot-pill">{slot.applicant_count} applicants</span>
            </div>

            <h5 className="fw-bold mb-1">{slot.interviewer_name}</h5>
            <p className="text-muted mb-3" style={{ fontSize: '0.85rem' }}>
              {formatSlotDate(slot.scheduled_at)} · {formatSlotDate(slot.end_at)} · {formatSlotTime(slot.scheduled_at)} - {formatSlotTime(slot.end_at)}
            </p>

            <div className="row g-3">
              <div className="col-md-6">
                <div className="dash-slot-field">
                  <div className="dash-slot-field-label">HIRING MANAGER</div>
                  <div className="dash-slot-field-value">{slot.interviewer_name}</div>
                </div>
              </div>
              {slot.location && (
                <div className="col-md-6">
                  <div className="dash-slot-field">
                    <div className="dash-slot-field-label">LOCATION</div>
                    <div className="dash-slot-field-value">{slot.location}</div>
                  </div>
                </div>
              )}
            </div>

            {slot.recruiters && slot.recruiters.length > 0 && (
              <div className="mt-3">
                <div className="dash-slot-field-label mb-2">RECRUITERS</div>
                <div className="d-flex gap-2 flex-wrap">
                  {slot.recruiters.map(r => (
                    <span key={r.id} className="dash-recruiter-chip">{r.name}</span>
                  ))}
                </div>
              </div>
            )}

            {slot.applicants && slot.applicants.length > 0 && (
              <div className="mt-3">
                <div className="dash-slot-field-label mb-2">APPLICANTS IN THIS SLOT</div>
                <div className="d-flex gap-2 flex-wrap">
                  {slot.applicants.map(a => (
                    <span key={a.id} className="dash-applicant-chip cursor-pointer"
                      onClick={() => navigate(`/candidates/${a.id}`)}>
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {slot.zoom_room && (
              <div className="row g-3 mt-1">
                <div className="col-md-6">
                  <div className="dash-slot-field">
                    <div className="dash-slot-field-label">ZOOM ROOM</div>
                    <div className="dash-slot-field-value">{slot.zoom_room}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="d-flex gap-2 mt-3">
              {slot.zoom_join_url && (
                <a href={slot.zoom_join_url} target="_blank" rel="noreferrer"
                  className="btn btn-outline-secondary btn-sm">Zoom</a>
              )}
              <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                onClick={() => navigate('/calendar')}>
                <i className="bi bi-box-arrow-up-right" style={{ fontSize: '0.7rem' }}></i> Bookings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Progress */}
      {kpiData && kpiData.length > 0 && (
        <div className="table-container mb-4">
          <div className="p-3 border-bottom d-flex align-items-center gap-2">
            <i className="bi bi-speedometer2" style={{ color: 'var(--primary)' }}></i>
            <h6 className="mb-0">Today's KPI Progress</h6>
          </div>
          <div className="p-3">
            {kpiData.map((kpi) => (
              <div key={kpi.recruiter_id} className="mb-3">
                {isAdminOrSubadmin && <div className="fw-medium mb-2">{kpi.recruiter_name}</div>}
                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="kpi-progress-item">
                      <div className="d-flex justify-content-between mb-1">
                        <small className="text-muted">Calls</small>
                        <small className="fw-bold">{kpi.calls_today}/{kpi.call_target}</small>
                      </div>
                      <div className="kpi-progress-bar">
                        <div className="kpi-progress-fill"
                          style={{
                            width: `${Math.min(kpi.call_attainment, 100)}%`,
                            background: kpi.call_attainment >= 100 ? 'var(--success)' : kpi.call_attainment >= 50 ? 'var(--primary)' : 'var(--warning)',
                          }} />
                      </div>
                      <small style={{ fontSize: '0.7rem' }} className="text-muted">{kpi.call_attainment}%</small>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="kpi-progress-item">
                      <div className="d-flex justify-content-between mb-1">
                        <small className="text-muted">Bookings</small>
                        <small className="fw-bold">{kpi.bookings_today}/{kpi.booking_target}</small>
                      </div>
                      <div className="kpi-progress-bar">
                        <div className="kpi-progress-fill"
                          style={{
                            width: `${Math.min(kpi.booking_attainment, 100)}%`,
                            background: kpi.booking_attainment >= 100 ? 'var(--success)' : kpi.booking_attainment >= 50 ? 'var(--primary)' : 'var(--warning)',
                          }} />
                      </div>
                      <small style={{ fontSize: '0.7rem' }} className="text-muted">{kpi.booking_attainment}%</small>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="kpi-progress-item">
                      <div className="d-flex justify-content-between mb-1">
                        <small className="text-muted">Status Changes</small>
                        <small className="fw-bold">{kpi.status_changes_today}</small>
                      </div>
                      <div className="kpi-progress-bar">
                        <div className="kpi-progress-fill"
                          style={{
                            width: `${Math.min(kpi.status_changes_today * 10, 100)}%`,
                            background: 'var(--primary)',
                          }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Booking Goals */}
      {isAdminOrSubadmin && (
        <div className="table-container mb-4">
          <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-bullseye" style={{ color: '#4f46e5', fontSize: '1.1rem' }}></i>
              <h6 className="mb-0 fw-bold">Weekly Booking Goals</h6>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="d-flex align-items-center gap-1">
                <button className="btn btn-outline-secondary btn-sm px-2" title="Previous week"
                  onClick={() => {
                    const d = new Date(goalsWeek + 'T00:00:00');
                    d.setDate(d.getDate() - 7);
                    setGoalsWeek(formatDateInput(d));
                  }}>
                  <i className="bi bi-chevron-left"></i>
                </button>
                <input type="date" className="form-control form-control-sm" style={{ width: '140px' }}
                  value={goalsWeek} onChange={e => setGoalsWeek(e.target.value)} />
                <button className="btn btn-outline-secondary btn-sm px-2" title="Next week"
                  onClick={() => {
                    const d = new Date(goalsWeek + 'T00:00:00');
                    d.setDate(d.getDate() + 7);
                    setGoalsWeek(formatDateInput(d));
                  }}>
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
              <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={openGoalForm}>
                <i className="bi bi-pencil-square"></i> Set Goals
              </button>
            </div>
          </div>

          {goalsData && goalsData.goals.length > 0 && (
            <div className="p-2 text-center" style={{ background: 'var(--bg-body)', fontSize: '0.8rem' }}>
              <strong>
                {new Date(goalsData.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' – '}
                {new Date(goalsData.week_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </strong>
            </div>
          )}

          {showGoalForm && (
            <div className="p-3 border-bottom" style={{ background: 'var(--bg-body)' }}>
              <h6 className="mb-3 fw-bold">Set Goals for Week of {goalsWeek}</h6>
              {goalFormRows.map((row, idx) => (
                <div key={idx} className="row g-2 mb-2 align-items-end">
                  <div className="col-md-4">
                    {idx === 0 && <label className="form-label" style={{ fontSize: '0.75rem' }}>Location</label>}
                    <select className="form-select form-select-sm" value={row.location}
                      onChange={e => {
                        const rows = [...goalFormRows];
                        rows[idx] = { ...rows[idx], location: e.target.value };
                        setGoalFormRows(rows);
                      }}>
                      <option value="">Select location...</option>
                      {allLocations.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    {idx === 0 && <label className="form-label" style={{ fontSize: '0.75rem' }}>Recruiter (optional)</label>}
                    <select className="form-select form-select-sm" value={row.recruiter}
                      onChange={e => {
                        const rows = [...goalFormRows];
                        rows[idx] = { ...rows[idx], recruiter: e.target.value };
                        setGoalFormRows(rows);
                      }}>
                      <option value="">All recruiters</option>
                      {allRecruiters.map(r => (
                        <option key={r.assigned_recruiter__id} value={r.assigned_recruiter__id}>
                          {r.assigned_recruiter__first_name} {r.assigned_recruiter__last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-2">
                    {idx === 0 && <label className="form-label" style={{ fontSize: '0.75rem' }}>Goal</label>}
                    <input type="number" min="0" className="form-control form-control-sm" value={row.goal}
                      onChange={e => {
                        const rows = [...goalFormRows];
                        rows[idx] = { ...rows[idx], goal: e.target.value };
                        setGoalFormRows(rows);
                      }} />
                  </div>
                  <div className="col-md-2">
                    <button className="btn btn-outline-danger btn-sm" onClick={() => removeGoalRow(idx)}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
              <div className="d-flex gap-2 mt-3">
                <button className="btn btn-outline-secondary btn-sm" onClick={addGoalRow}>
                  <i className="bi bi-plus-lg me-1"></i>Add Row
                </button>
                <button className="btn btn-primary btn-sm" onClick={saveGoals} disabled={goalSaving}>
                  {goalSaving ? 'Saving...' : 'Save Goals'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowGoalForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table className="table table-sm mb-0" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#4f46e5', color: '#fff' }}>
                  <th style={{ padding: '8px 12px' }}>LOCATION</th>
                  <th className="text-center" style={{ padding: '8px 12px' }}>Goal</th>
                  <th className="text-center" style={{ padding: '8px 12px' }}>Booked</th>
                  <th className="text-center" style={{ padding: '8px 12px' }}>Showed</th>
                  <th className="text-center" style={{ padding: '8px 12px' }}>Remaining</th>
                  <th className="text-center" style={{ padding: '8px 12px' }}>Show Up</th>
                </tr>
              </thead>
              <tbody>
                {(!goalsData || goalsData.goals.length === 0) ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">
                      No goals set for this week. Click "Set Goals" to get started.
                    </td>
                  </tr>
                ) : goalsData.goals.map((g) => {
                  const met = g.booked >= g.goal;
                  const rowBg = met ? '#dcfce720' : '#fef3c720';
                  return (
                    <tr key={g.id} style={{ background: rowBg }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span className="fw-medium">{g.location_name}</span>
                        {g.recruiter_name && (
                          <span className="text-muted"> ({g.recruiter_name})</span>
                        )}
                      </td>
                      <td className="text-center fw-bold" style={{ padding: '8px 12px' }}>{g.goal}</td>
                      <td className="text-center fw-bold" style={{ padding: '8px 12px' }}>{g.booked}</td>
                      <td className="text-center" style={{ padding: '8px 12px' }}>{g.showed}</td>
                      <td className="text-center" style={{ padding: '8px 12px' }}>
                        <span className={g.remaining > 0 ? 'text-danger fw-bold' : ''}>{g.remaining}</span>
                      </td>
                      <td className="text-center" style={{ padding: '8px 12px' }}>
                        <span style={{
                          color: g.show_up_pct >= 50 ? '#16a34a' : g.show_up_pct > 0 ? '#ea580c' : '#94a3b8',
                          fontWeight: 600,
                        }}>
                          {g.show_up_pct.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {goalsData && goalsData.goals.length > 0 && (
                  <tr style={{ background: '#4f46e510', fontWeight: 700 }}>
                    <td style={{ padding: '8px 12px' }}>TOTAL</td>
                    <td className="text-center" style={{ padding: '8px 12px' }}>{goalsData.totals.goal}</td>
                    <td className="text-center" style={{ padding: '8px 12px' }}>{goalsData.totals.booked}</td>
                    <td className="text-center" style={{ padding: '8px 12px' }}>{goalsData.totals.showed}</td>
                    <td className="text-center" style={{ padding: '8px 12px' }}>{goalsData.totals.remaining}</td>
                    <td className="text-center" style={{ padding: '8px 12px' }}>
                      {goalsData.totals.show_up_pct.toFixed(2)}%
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      {isAdminOrSubadmin && data?.daily_leads && (
        <div className="row g-3 mb-4">
          <div className="col-lg-6">
            <LineChart
              labels={data.daily_leads.labels}
              data={data.daily_leads.data}
              color="#4f46e5"
              title="Daily Leads Upload Pattern"
              subtitle={`Selected range: ${appliedFrom} to ${appliedTo}`}
            />
          </div>
          <div className="col-lg-6">
            <LineChart
              labels={data.daily_calls.labels}
              data={data.daily_calls.data}
              color="#059669"
              title="Daily Call Pattern"
              subtitle={`Selected range: ${appliedFrom} to ${appliedTo}`}
            />
          </div>
        </div>
      )}

      {/* Recruiter Stats & Status Breakdown */}
      {isAdminOrSubadmin && (
        <div className="row g-3 mb-4">
          {data?.status_breakdown && data.status_breakdown.length > 0 && (
            <div className="col-md-5">
              <div className="table-container">
                <div className="p-3 border-bottom d-flex align-items-center gap-2">
                  <i className="bi bi-pie-chart-fill" style={{ color: 'var(--primary)' }}></i>
                  <h6 className="mb-0">Status Breakdown</h6>
                </div>
                <div className="p-3">
                  {data.status_breakdown.slice(0, 10).map((s, i) => (
                    <div key={i} className="d-flex align-items-center justify-content-between py-1" style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <small className="text-muted">{STATUS_LABELS[s.current_status] || s.current_status}</small>
                      <span className="fw-bold" style={{ fontSize: '0.85rem' }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {data?.recruiter_stats && data.recruiter_stats.length > 0 && (
            <div className="col-md-7">
              <div className="table-container">
                <div className="p-3 border-bottom d-flex align-items-center gap-2">
                  <i className="bi bi-person-badge-fill" style={{ color: 'var(--primary)' }}></i>
                  <h6 className="mb-0">Recruiter Performance</h6>
                </div>
                <table className="table table-sm mb-0">
                  <thead><tr><th>Recruiter</th><th className="text-end">Total</th><th className="text-end">Fresh</th><th className="text-end">Pipeline</th><th className="text-end">Selected</th><th className="text-end">Joined</th></tr></thead>
                  <tbody>
                    {data.recruiter_stats.map((r, i) => (
                      <tr key={i}>
                        <td><small className="fw-medium">{r.assigned_recruiter__first_name} {r.assigned_recruiter__last_name}</small></td>
                        <td className="text-end"><small className="fw-bold">{r.total}</small></td>
                        <td className="text-end"><small>{r.fresh}</small></td>
                        <td className="text-end"><small>{r.pipeline}</small></td>
                        <td className="text-end"><small style={{ color: 'var(--success)' }}>{r.selected}</small></td>
                        <td className="text-end"><small style={{ color: 'var(--success)' }}>{r.joined}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
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
                  <td className="text-capitalize"><small>{log.action_type.replace(/_/g, ' ')}</small></td>
                  <td><small>{log.new_value || log.remarks || '-'}</small></td>
                  <td><small>{log.performed_by_name || '-'}</small></td>
                  <td><small style={{ fontFamily: 'monospace' }}>{formatDateTime(log.created_at)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
