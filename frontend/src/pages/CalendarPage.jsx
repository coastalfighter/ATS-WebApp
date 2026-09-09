import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { interviewsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => { loadInterviews(); }, [year, month]);

  const loadInterviews = async () => {
    setLoading(true);
    try {
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const { data } = await interviewsAPI.list({
        scheduled_after: startDate,
        scheduled_before: endDate,
        page_size: 200,
      });
      setInterviews(data.results || data || []);
    } catch (err) {
      setError('Failed to load calendar data.');
    } finally {
      setLoading(false);
    }
  };

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const today = new Date();
  const isToday = (day) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const getInterviewsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return interviews.filter(iv => iv.scheduled_at && iv.scheduled_at.startsWith(dateStr));
  };

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
    setSelectedDate(null);
  };

  const selectedInterviews = selectedDate ? getInterviewsForDay(selectedDate) : [];

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  return (
    <div>
      <div className="page-header">
        <h1>Calendar</h1>
      </div>
      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="table-container p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button className="btn btn-outline-secondary btn-sm" onClick={prevMonth}>
            <i className="bi bi-chevron-left"></i> Prev
          </button>
          <h5 className="mb-0">{monthNames[month]} {year}</h5>
          <button className="btn btn-outline-secondary btn-sm" onClick={nextMonth}>
            Next <i className="bi bi-chevron-right"></i>
          </button>
        </div>

        {loading ? <LoadingSpinner /> : (
          <div className="calendar-grid">
            {dayNames.map(d => (
              <div key={d} className="calendar-header-cell">{d}</div>
            ))}
            {calendarCells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="calendar-cell empty"></div>;
              const dayInterviews = getInterviewsForDay(day);
              const scheduled = dayInterviews.filter(iv => iv.status === 'scheduled').length;
              const completed = dayInterviews.filter(iv => iv.status === 'completed').length;
              const cancelled = dayInterviews.filter(iv => iv.status === 'cancelled').length;
              const isSelected = selectedDate === day;
              return (
                <div
                  key={day}
                  className={`calendar-cell ${isToday(day) ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayInterviews.length > 0 ? 'has-events' : ''}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="calendar-day">{day}</div>
                  {scheduled > 0 && <span className="calendar-badge">{scheduled} scheduled</span>}
                  {completed > 0 && <span className="calendar-badge" style={{background:'var(--success)'}}>{completed} done</span>}
                  {cancelled > 0 && <span className="calendar-badge" style={{background:'var(--danger)'}}>{cancelled} cancelled</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedDate && (
        <div className="table-container p-3">
          <h6 className="mb-3">
            <i className="bi bi-calendar-event me-2"></i>
            {monthNames[month]} {selectedDate}, {year}
            <span className="badge bg-secondary ms-2">{selectedInterviews.length} interview{selectedInterviews.length !== 1 ? 's' : ''}</span>
          </h6>
          {selectedInterviews.length === 0 ? (
            <p className="text-muted small">No interviews scheduled for this day.</p>
          ) : (
            <table className="table table-sm">
              <thead>
                <tr><th>Time</th><th>Candidate</th><th>Type</th><th>Interviewer</th><th>Duration</th><th>Status</th><th>Zoom</th></tr>
              </thead>
              <tbody>
                {selectedInterviews.map(iv => (
                  <tr key={iv.id}>
                    <td style={{fontFamily:'monospace'}}>
                      {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}) : '-'}
                    </td>
                    <td className="cursor-pointer fw-medium" onClick={() => navigate(`/candidates/${iv.candidate}`)}>
                      {iv.candidate_detail ? `${iv.candidate_detail.first_name} ${iv.candidate_detail.last_name}` : `#${iv.candidate}`}
                    </td>
                    <td className="text-capitalize">{iv.interview_type}</td>
                    <td>{iv.interviewer_name}</td>
                    <td>{iv.duration_minutes} min</td>
                    <td>
                      <span className={`badge bg-${iv.status === 'scheduled' ? 'primary' : iv.status === 'completed' ? 'success' : 'danger'}`}>
                        {iv.status}
                      </span>
                    </td>
                    <td>{iv.zoom_join_url ? <a href={iv.zoom_join_url} target="_blank" rel="noreferrer">Join</a> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
