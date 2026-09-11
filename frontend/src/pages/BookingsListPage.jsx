import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';

const STATUS_COLORS = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'secondary',
  no_show: 'danger',
};

export default function BookingsListPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [roundFilter, setRoundFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (statusFilter) params.status = statusFilter;
      if (roundFilter) params.round = roundFilter;
      if (search) params.search = search;
      const { data } = await bookingsAPI.list(params);
      setBookings(data.results || []);
      setCount(data.count || 0);
      setTotalPages(Math.ceil((data.count || 0) / 25));
    } catch {
      setError('Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, roundFilter, search]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleConfirm = async (id) => {
    try {
      await bookingsAPI.confirm(id);
      setSuccess('Booking confirmed.');
      loadBookings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to confirm booking.');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await bookingsAPI.cancel(id, {});
      setSuccess('Booking cancelled.');
      loadBookings();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to cancel booking.');
    }
  };

  const handleMarkNoShow = async (id) => {
    try {
      await bookingsAPI.markNoShow(id);
      setSuccess('Marked as no-show.');
      loadBookings();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to mark no-show.');
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setRoundFilter('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="fresh-leads">
      <div className="fl-header">
        <span className="fl-badge">HIRING OPERATIONS</span>
        <h1 className="fl-title">Bookings</h1>
        <p className="fl-subtitle">All interview bookings across slots</p>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />
      {success && (
        <div className="alert alert-success d-flex align-items-center gap-2 py-2" style={{ fontSize: '0.875rem' }}>
          <i className="bi bi-check-circle-fill"></i> {success}
          <button className="btn-close ms-auto" style={{ fontSize: '0.65rem' }} onClick={() => setSuccess('')}></button>
        </div>
      )}

      <div className="fl-master-section">
        <div className="fl-master-header">
          <div>
            <h2 className="fl-master-title">Booking Records</h2>
            <p className="fl-master-sub"><strong>{count}</strong> bookings found</p>
          </div>
        </div>
        <div className="fl-filters">
          <input type="text" className="fl-filter-input" placeholder="Search candidate..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); loadBookings(); } }} />
          <select className="fl-filter-select" value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
          <select className="fl-filter-select" value={roundFilter}
            onChange={(e) => { setRoundFilter(e.target.value); setPage(1); }}>
            <option value="">All Rounds</option>
            <option value="round_1">Round 1</option>
            <option value="round_2">Round 2</option>
          </select>
          <button className="fl-btn fl-btn-outline" onClick={clearFilters}>
            <i className="bi bi-x-circle"></i> Clear
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="table-container">
            <table className="table table-hover table-sm mb-0">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Slot Date</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Round</th>
                  <th>Status</th>
                  <th>Booked By</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr><td colSpan="9" className="text-center text-muted py-4">No bookings found.</td></tr>
                ) : bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="fw-medium text-primary" style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/candidates/${b.candidate}`)}>
                        {b.candidate_name}
                      </span>
                    </td>
                    <td>{b.slot_date || '-'}</td>
                    <td>{b.slot_start_time?.slice(0, 5)}{b.slot_end_time ? ` - ${b.slot_end_time.slice(0, 5)}` : ''}</td>
                    <td>{b.location_name || '-'}</td>
                    <td>
                      <span className="badge bg-info" style={{ fontSize: '0.7rem' }}>
                        {b.round === 'round_1' ? 'R1' : 'R2'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge bg-${STATUS_COLORS[b.status] || 'secondary'}`}
                        style={{ fontSize: '0.72rem' }}>
                        {b.status}
                      </span>
                    </td>
                    <td><small>{b.booked_by_name || '-'}</small></td>
                    <td><small className="text-muted">{b.created_at?.slice(0, 10)}</small></td>
                    <td>
                      <div className="d-flex gap-1">
                        {b.status === 'pending' && (
                          <button className="btn btn-outline-success btn-sm py-0 px-1"
                            title="Confirm" onClick={() => handleConfirm(b.id)}>
                            <i className="bi bi-check-lg"></i>
                          </button>
                        )}
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <>
                            <button className="btn btn-outline-danger btn-sm py-0 px-1"
                              title="Cancel" onClick={() => handleCancel(b.id)}>
                              <i className="bi bi-x-lg"></i>
                            </button>
                            <button className="btn btn-outline-warning btn-sm py-0 px-1"
                              title="No Show" onClick={() => handleMarkNoShow(b.id)}>
                              <i className="bi bi-person-x"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-3">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
