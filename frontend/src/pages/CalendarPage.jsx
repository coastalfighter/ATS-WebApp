import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { interviewsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const VIEWS = { MONTH: 'month', WEEK: 'week', DAY: 'day' };

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatHour(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d);
    nd.setDate(d.getDate() + i);
    return nd;
  });
}

function getMonthDates(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const dates = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    dates.push({ date: d, isCurrentMonth: false });
  }
  for (let d = 1; d <= last.getDate(); d++) {
    dates.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  const remaining = 42 - dates.length;
  for (let d = 1; d <= remaining; d++) {
    dates.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
  }
  return dates;
}

const STATUS_COLORS = {
  scheduled: { bg: '#4f46e5', text: '#fff' },
  completed: { bg: '#059669', text: '#fff' },
  cancelled: { bg: '#dc2626', text: '#fff' },
  rescheduled: { bg: '#d97706', text: '#fff' },
};

function EventBlock({ interview, onClick, style }) {
  const time = new Date(interview.scheduled_at);
  const colors = STATUS_COLORS[interview.status] || STATUS_COLORS.scheduled;
  const candidateName = interview.candidate_detail
    ? `${interview.candidate_detail.first_name} ${interview.candidate_detail.last_name}`
    : `#${interview.candidate}`;

  return (
    <div
      className="gcal-event"
      style={{
        ...style,
        backgroundColor: interview.status === 'cancelled' ? `${colors.bg}30` : colors.bg,
        color: interview.status === 'cancelled' ? colors.bg : colors.text,
        borderLeft: `3px solid ${colors.bg}`,
        textDecoration: interview.status === 'cancelled' ? 'line-through' : 'none',
      }}
      onClick={(e) => { e.stopPropagation(); onClick(interview); }}
      title={`${formatTime(time)} - ${candidateName}`}
    >
      <div className="gcal-event-time">{formatTime(time)}</div>
      <div className="gcal-event-title">{candidateName}</div>
      <div className="gcal-event-type">{interview.interview_type}</div>
    </div>
  );
}

function InterviewDetailModal({ interview, onClose }) {
  const navigate = useNavigate();
  if (!interview) return null;
  const time = new Date(interview.scheduled_at);
  const endTime = new Date(time.getTime() + interview.duration_minutes * 60000);
  const colors = STATUS_COLORS[interview.status] || STATUS_COLORS.scheduled;
  const candidateName = interview.candidate_detail
    ? `${interview.candidate_detail.first_name} ${interview.candidate_detail.last_name}`
    : `#${interview.candidate}`;

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-content-custom" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className="d-flex align-items-center gap-2">
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: colors.bg, flexShrink: 0 }} />
            <h6 className="mb-0 fw-bold">{interview.interview_type.charAt(0).toUpperCase() + interview.interview_type.slice(1)} Interview</h6>
          </div>
          <button className="btn btn-sm p-0 border-0" onClick={onClose}>
            <i className="bi bi-x-lg text-muted"></i>
          </button>
        </div>

        <div className="mb-3">
          <span className={`badge bg-${interview.status === 'scheduled' ? 'primary' : interview.status === 'completed' ? 'success' : interview.status === 'cancelled' ? 'danger' : 'warning'}`}>
            {interview.status}
          </span>
        </div>

        <div className="gcal-detail-grid">
          <div className="gcal-detail-row">
            <i className="bi bi-clock"></i>
            <div>
              <div className="fw-medium">{time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <small className="text-muted">{formatTime(time)} - {formatTime(endTime)} ({interview.duration_minutes} min)</small>
            </div>
          </div>

          <div className="gcal-detail-row">
            <i className="bi bi-person"></i>
            <div>
              <div className="fw-medium cursor-pointer" style={{ color: 'var(--primary)' }}
                onClick={() => navigate(`/candidates/${interview.candidate}`)}>
                {candidateName}
              </div>
              <small className="text-muted">Candidate</small>
            </div>
          </div>

          <div className="gcal-detail-row">
            <i className="bi bi-person-badge"></i>
            <div>
              <div className="fw-medium">{interview.interviewer_name}</div>
              <small className="text-muted">{interview.interviewer_email}</small>
            </div>
          </div>

          {interview.location && (
            <div className="gcal-detail-row">
              <i className="bi bi-geo-alt"></i>
              <div><div className="fw-medium">{interview.location}</div></div>
            </div>
          )}

          {interview.zoom_join_url && (
            <div className="gcal-detail-row">
              <i className="bi bi-camera-video"></i>
              <div>
                <a href={interview.zoom_join_url} target="_blank" rel="noreferrer" className="fw-medium">
                  Join Zoom Meeting
                </a>
                {interview.zoom_room_name && <small className="text-muted d-block">Room: {interview.zoom_room_name}</small>}
              </div>
            </div>
          )}

          {interview.notes && (
            <div className="gcal-detail-row">
              <i className="bi bi-journal-text"></i>
              <div>
                <small className="text-muted">Notes</small>
                <div style={{ fontSize: '0.85rem' }}>{interview.notes}</div>
              </div>
            </div>
          )}

          <div className="gcal-detail-row">
            <i className="bi bi-person-check"></i>
            <div>
              <small className="text-muted">Created by {interview.created_by_name}</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState(VIEWS.WEEK);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInterview, setSelectedInterview] = useState(null);

  const today = useMemo(() => new Date(), []);

  const dateRange = useMemo(() => {
    if (view === VIEWS.MONTH) {
      const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 6);
      first.setDate(first.getDate() - first.getDay());
      return { start: first, end: last };
    }
    if (view === VIEWS.WEEK) {
      const weekDates = getWeekDates(currentDate);
      return { start: weekDates[0], end: new Date(weekDates[6].getTime() + 86400000) };
    }
    return { start: new Date(currentDate), end: new Date(currentDate.getTime() + 86400000) };
  }, [currentDate, view]);

  const loadInterviews = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await interviewsAPI.list({
        scheduled_after: dateRange.start.toISOString().split('T')[0],
        scheduled_before: dateRange.end.toISOString().split('T')[0],
        page_size: 200,
      });
      setInterviews(data.results || data || []);
    } catch {
      setError('Failed to load calendar data.');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { loadInterviews(); }, [loadInterviews]);

  const navigateDate = (dir) => {
    const d = new Date(currentDate);
    if (view === VIEWS.MONTH) d.setMonth(d.getMonth() + dir);
    else if (view === VIEWS.WEEK) d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const headerLabel = useMemo(() => {
    if (view === VIEWS.MONTH) {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (view === VIEWS.WEEK) {
      const weekDates = getWeekDates(currentDate);
      const s = weekDates[0];
      const e = weekDates[6];
      if (s.getMonth() === e.getMonth()) {
        return `${s.toLocaleDateString('en-US', { month: 'long' })} ${s.getDate()} - ${e.getDate()}, ${s.getFullYear()}`;
      }
      return `${s.toLocaleDateString('en-US', { month: 'short' })} ${s.getDate()} - ${e.toLocaleDateString('en-US', { month: 'short' })} ${e.getDate()}, ${e.getFullYear()}`;
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [currentDate, view]);

  const getInterviewsForDay = (date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return interviews.filter(iv => iv.scheduled_at && iv.scheduled_at.startsWith(dateStr));
  };

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div>
      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="gcal-toolbar">
        <div className="gcal-toolbar-left">
          <button className="btn btn-outline-secondary btn-sm" onClick={goToday}>Today</button>
          <div className="gcal-nav-arrows">
            <button className="btn btn-sm" onClick={() => navigateDate(-1)}>
              <i className="bi bi-chevron-left"></i>
            </button>
            <button className="btn btn-sm" onClick={() => navigateDate(1)}>
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
          <h5 className="gcal-header-label">{headerLabel}</h5>
        </div>
        <div className="gcal-toolbar-right">
          <div className="gcal-view-switcher">
            {[{ key: VIEWS.DAY, label: 'Day' }, { key: VIEWS.WEEK, label: 'Week' }, { key: VIEWS.MONTH, label: 'Month' }].map(v => (
              <button key={v.key} className={`gcal-view-btn ${view === v.key ? 'active' : ''}`}
                onClick={() => setView(v.key)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {view === VIEWS.MONTH && (
            <MonthView
              currentDate={currentDate}
              today={today}
              getInterviewsForDay={getInterviewsForDay}
              onSelectInterview={setSelectedInterview}
              onSelectDate={(d) => { setCurrentDate(d); setView(VIEWS.DAY); }}
              dayNames={dayNames}
            />
          )}
          {view === VIEWS.WEEK && (
            <WeekView
              currentDate={currentDate}
              today={today}
              interviews={interviews}
              onSelectInterview={setSelectedInterview}
              dayNames={dayNames}
            />
          )}
          {view === VIEWS.DAY && (
            <DayView
              currentDate={currentDate}
              today={today}
              interviews={interviews}
              onSelectInterview={setSelectedInterview}
            />
          )}
        </>
      )}

      <InterviewDetailModal interview={selectedInterview} onClose={() => setSelectedInterview(null)} />
    </div>
  );
}

function MonthView({ currentDate, today, getInterviewsForDay, onSelectInterview, onSelectDate, dayNames }) {
  const monthDates = getMonthDates(currentDate.getFullYear(), currentDate.getMonth());

  return (
    <div className="gcal-month">
      <div className="gcal-month-header">
        {dayNames.map(d => <div key={d} className="gcal-month-header-cell">{d}</div>)}
      </div>
      <div className="gcal-month-grid">
        {monthDates.map(({ date, isCurrentMonth }, i) => {
          const dayInterviews = getInterviewsForDay(date);
          const isToday = isSameDay(date, today);
          return (
            <div key={i} className={`gcal-month-cell ${!isCurrentMonth ? 'other-month' : ''}`}
              onClick={() => onSelectDate(date)}>
              <div className={`gcal-month-day ${isToday ? 'today' : ''}`}>{date.getDate()}</div>
              <div className="gcal-month-events">
                {dayInterviews.slice(0, 3).map(iv => {
                  const colors = STATUS_COLORS[iv.status] || STATUS_COLORS.scheduled;
                  const t = new Date(iv.scheduled_at);
                  return (
                    <div key={iv.id} className="gcal-month-event"
                      style={{
                        backgroundColor: iv.status === 'cancelled' ? `${colors.bg}20` : `${colors.bg}15`,
                        color: colors.bg,
                        borderLeft: `3px solid ${colors.bg}`,
                      }}
                      onClick={(e) => { e.stopPropagation(); onSelectInterview(iv); }}>
                      <span className="gcal-month-event-time">{formatTime(t)}</span>
                      <span className="gcal-month-event-title">
                        {iv.candidate_detail ? iv.candidate_detail.first_name : `#${iv.candidate}`}
                      </span>
                    </div>
                  );
                })}
                {dayInterviews.length > 3 && (
                  <div className="gcal-month-more">+{dayInterviews.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ currentDate, today, interviews, onSelectInterview, dayNames }) {
  const weekDates = getWeekDates(currentDate);

  const getInterviewsForDate = (date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return interviews.filter(iv => iv.scheduled_at && iv.scheduled_at.startsWith(dateStr));
  };

  return (
    <div className="gcal-time-grid">
      <div className="gcal-time-grid-header">
        <div className="gcal-time-gutter-header"></div>
        {weekDates.map((date, i) => {
          const isToday = isSameDay(date, today);
          return (
            <div key={i} className={`gcal-time-grid-header-cell ${isToday ? 'today' : ''}`}>
              <div className="gcal-day-name">{dayNames[i]}</div>
              <div className={`gcal-day-number ${isToday ? 'today' : ''}`}>{date.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div className="gcal-time-grid-body">
        <div className="gcal-time-gutter">
          {HOURS.map(h => (
            <div key={h} className="gcal-time-slot-label">{h > 0 ? formatHour(h) : ''}</div>
          ))}
        </div>
        <div className="gcal-time-grid-columns">
          {weekDates.map((date, colIdx) => {
            const dayInterviews = getInterviewsForDate(date);
            const isToday = isSameDay(date, today);
            return (
              <div key={colIdx} className={`gcal-time-column ${isToday ? 'today' : ''}`}>
                {HOURS.map(h => (
                  <div key={h} className="gcal-time-slot"></div>
                ))}
                {dayInterviews.map(iv => {
                  const t = new Date(iv.scheduled_at);
                  const topPx = (t.getHours() * 60 + t.getMinutes()) * (60 / 60);
                  const heightPx = Math.max(iv.duration_minutes, 15);
                  return (
                    <EventBlock
                      key={iv.id}
                      interview={iv}
                      onClick={onSelectInterview}
                      style={{
                        position: 'absolute',
                        top: `${topPx}px`,
                        height: `${heightPx}px`,
                        left: '2px',
                        right: '2px',
                        zIndex: 2,
                      }}
                    />
                  );
                })}
                {isToday && (() => {
                  const now = new Date();
                  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
                  return (
                    <div className="gcal-now-line" style={{ top: `${minutesSinceMidnight}px` }}>
                      <div className="gcal-now-dot"></div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayView({ currentDate, today, interviews, onSelectInterview }) {
  const isToday = isSameDay(currentDate, today);
  const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const dayInterviews = interviews.filter(iv => iv.scheduled_at && iv.scheduled_at.startsWith(dateStr));

  return (
    <div className="gcal-time-grid">
      <div className="gcal-time-grid-header">
        <div className="gcal-time-gutter-header"></div>
        <div className={`gcal-time-grid-header-cell single ${isToday ? 'today' : ''}`}>
          <div className="gcal-day-name">
            {currentDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
          </div>
          <div className={`gcal-day-number ${isToday ? 'today' : ''}`}>{currentDate.getDate()}</div>
        </div>
      </div>
      <div className="gcal-time-grid-body">
        <div className="gcal-time-gutter">
          {HOURS.map(h => (
            <div key={h} className="gcal-time-slot-label">{h > 0 ? formatHour(h) : ''}</div>
          ))}
        </div>
        <div className="gcal-time-grid-columns single">
          <div className={`gcal-time-column ${isToday ? 'today' : ''}`}>
            {HOURS.map(h => (
              <div key={h} className="gcal-time-slot"></div>
            ))}
            {dayInterviews.map(iv => {
              const t = new Date(iv.scheduled_at);
              const topPx = (t.getHours() * 60 + t.getMinutes());
              const heightPx = Math.max(iv.duration_minutes, 15);
              return (
                <EventBlock
                  key={iv.id}
                  interview={iv}
                  onClick={onSelectInterview}
                  style={{
                    position: 'absolute',
                    top: `${topPx}px`,
                    height: `${heightPx}px`,
                    left: '4px',
                    right: '4px',
                    zIndex: 2,
                  }}
                />
              );
            })}
            {isToday && (() => {
              const now = new Date();
              const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
              return (
                <div className="gcal-now-line" style={{ top: `${minutesSinceMidnight}px` }}>
                  <div className="gcal-now-dot"></div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
