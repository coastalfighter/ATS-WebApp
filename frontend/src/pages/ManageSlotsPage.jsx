import React, { useState, useEffect, useCallback } from 'react';
import { interviewSlotsAPI, locationsAPI, usersAPI, zoomRoomsAPI, bookingsAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';

const STATUS_LABELS = {
  open: 'Open',
  partially_booked: 'Partially Booked',
  fully_booked: 'Fully Booked',
  cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  open: 'success',
  partially_booked: 'warning',
  fully_booked: 'primary',
  cancelled: 'danger',
};

const ACTIVE_STATUSES = ['open', 'partially_booked', 'fully_booked'];

const INITIAL_FORM = {
  location: '',
  hiring_manager: '',
  date: '',
  start_time: '',
  end_time: '',
  max_capacity: 1,
  meeting_link: '',
  zoom_account: '',
};

function formatTime(t) {
  if (!t) return '-';
  return t.slice(0, 5);
}

export default function ManageSlotsPage() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  // Filters
  const [locationFilter, setLocationFilter] = useState('');
  const [hmFilter, setHmFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Reference data
  const [locations, setLocations] = useState([]);
  const [hiringManagers, setHiringManagers] = useState([]);
  const [zoomRooms, setZoomRooms] = useState([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Capacity modal
  const [capSlot, setCapSlot] = useState(null);
  const [capValue, setCapValue] = useState(1);
  const [capSubmitting, setCapSubmitting] = useState(false);

  // Slot bookings expansion
  const [expandedSlotId, setExpandedSlotId] = useState(null);
  const [slotBookings, setSlotBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  useEffect(() => {
    locationsAPI.list({ active_only: 'true' }).then(({ data }) => {
      setLocations(Array.isArray(data) ? data : data.results || []);
    }).catch(() => {});
    usersAPI.getRecruiters({ active_only: true }).then(({ data }) => {
      setHiringManagers(Array.isArray(data) ? data : data.results || []);
    }).catch(() => {});
    zoomRoomsAPI.list().then(({ data }) => {
      const rooms = Array.isArray(data) ? data : data.results || [];
      setZoomRooms(rooms.filter(r => r.is_active));
    }).catch(() => {});
  }, []);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (locationFilter) params.location = locationFilter;
      if (hmFilter) params.hiring_manager = hmFilter;
      if (statusFilter === 'active') {
        params.active_only = 'true';
      } else if (statusFilter) {
        params.status = statusFilter;
      }
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const { data } = await interviewSlotsAPI.list(params);
      setSlots(data.results || []);
      setCount(data.count || 0);
      setTotalPages(Math.ceil((data.count || 0) / 25));
    } catch {
      setError('Failed to load slots.');
    } finally {
      setLoading(false);
    }
  }, [page, locationFilter, hmFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const clearFilters = () => {
    setLocationFilter('');
    setHmFilter('');
    setStatusFilter('active');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // Add Slot
  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddSlot = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.location || !form.hiring_manager || !form.date || !form.start_time || !form.end_time) {
      setFormError('Location, Hiring Manager, Date, Start Time and End Time are required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        location: Number(form.location),
        hiring_manager: Number(form.hiring_manager),
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        max_capacity: Number(form.max_capacity) || 1,
      };
      if (form.meeting_link) payload.meeting_link = form.meeting_link;
      if (form.zoom_account) payload.zoom_account = Number(form.zoom_account);
      await interviewSlotsAPI.create(payload);
      setShowModal(false);
      setForm(INITIAL_FORM);
      setSuccess('Slot created successfully.');
      loadSlots();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === 'object') {
        const msgs = Object.values(detail).flat().join(' ');
        setFormError(msgs || 'Failed to create slot.');
      } else {
        setFormError('Failed to create slot.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel slot
  const handleCancel = async (slot) => {
    if (!window.confirm(`Cancel the slot on ${slot.date} (${formatTime(slot.start_time)} - ${formatTime(slot.end_time)})?`)) return;
    try {
      await interviewSlotsAPI.cancel(slot.id);
      setSuccess('Slot cancelled.');
      loadSlots();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to cancel slot.');
    }
  };

  // Update capacity
  const openCapModal = (slot) => {
    setCapSlot(slot);
    setCapValue(slot.max_capacity);
  };

  const handleCapUpdate = async () => {
    if (!capSlot) return;
    setCapSubmitting(true);
    try {
      await interviewSlotsAPI.updateCapacity(capSlot.id, { max_capacity: capValue });
      setCapSlot(null);
      setSuccess('Capacity updated.');
      loadSlots();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update capacity.');
    } finally {
      setCapSubmitting(false);
    }
  };

  const toggleSlotBookings = async (slotId) => {
    if (expandedSlotId === slotId) {
      setExpandedSlotId(null);
      setSlotBookings([]);
      return;
    }
    setExpandedSlotId(slotId);
    setBookingsLoading(true);
    try {
      const { data } = await bookingsAPI.list({ interview_slot: slotId });
      setSlotBookings(data.results || data);
    } catch {
      setSlotBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  };

  return (
    <div className="fresh-leads">
      {/* Page Header */}
      <div className="fl-header">
        <span className="fl-badge">HIRING OPERATIONS</span>
        <h1 className="fl-title">Manage Slots</h1>
        <p className="fl-subtitle">Current and upcoming interview capacity</p>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />
      {success && (
        <div className="alert alert-success d-flex align-items-center gap-2 py-2" style={{fontSize:'0.875rem'}}>
          <i className="bi bi-check-circle-fill"></i> {success}
          <button className="btn-close ms-auto" style={{fontSize:'0.65rem'}} onClick={() => setSuccess('')}></button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="fl-master-section">
        <div className="fl-master-header">
          <div>
            <h2 className="fl-master-title">Manage Slots</h2>
            <p className="fl-master-sub">Current and upcoming active interview slots with date-wise filtering</p>
          </div>
        </div>
        <div className="fl-filters">
          <select className="fl-filter-select" value={locationFilter}
            onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}>
            <option value="">All Locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.city})</option>
            ))}
          </select>
          <select className="fl-filter-select" value={hmFilter}
            onChange={(e) => { setHmFilter(e.target.value); setPage(1); }}>
            <option value="">All HMs</option>
            {hiringManagers.map((h) => (
              <option key={h.id} value={h.id}>{h.full_name || `${h.first_name} ${h.last_name}`}</option>
            ))}
          </select>
          <select className="fl-filter-select" value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="active">All Active Statuses</option>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="partially_booked">Partially Booked</option>
            <option value="fully_booked">Fully Booked</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input type="date" className="fl-filter-input fl-filter-sm" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} title="From date" />
          <input type="date" className="fl-filter-input fl-filter-sm" value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }} title="To date" />
          <button className="fl-btn fl-btn-outline" onClick={clearFilters}>
            <i className="bi bi-x-circle"></i> Clear
          </button>
          <button className="fl-btn fl-btn-primary" onClick={() => { setShowModal(true); setFormError(''); setForm(INITIAL_FORM); }}>
            <i className="bi bi-plus-circle"></i> Add Slot
          </button>
        </div>
      </div>

      {/* Slots Table */}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="table-container">
            <table className="table table-hover table-sm mb-0">
              <thead>
                <tr>
                  <th>HM</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Meeting</th>
                  <th>Zoom Room</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slots.length === 0 ? (
                  <tr><td colSpan="9" className="text-center text-muted py-4">No interview slots found.</td></tr>
                ) : slots.map((slot) => (
                  <React.Fragment key={slot.id}>
                  <tr>
                    <td className="fw-medium">{slot.hiring_manager_name || '-'}</td>
                    <td>{slot.location_name || '-'}</td>
                    <td>{slot.date}</td>
                    <td>{formatTime(slot.start_time)} &ndash; {formatTime(slot.end_time)}</td>
                    <td>
                      <span className="fw-medium">{slot.booked_count}</span>
                      <span className="text-muted">/{slot.max_capacity}</span>
                    </td>
                    <td>
                      <span className={`badge bg-${STATUS_COLORS[slot.status] || 'secondary'}`}
                        style={{fontSize:'0.72rem'}}>
                        {STATUS_LABELS[slot.status] || slot.status}
                      </span>
                    </td>
                    <td>
                      {slot.meeting_link ? (
                        <a href={slot.meeting_link} target="_blank" rel="noopener noreferrer"
                          className="d-inline-flex align-items-center gap-1" style={{fontSize:'0.85rem'}}>
                          <i className="bi bi-camera-video-fill"></i> Join
                        </a>
                      ) : <span className="text-muted">-</span>}
                    </td>
                    <td>
                      {slot.zoom_room_name ? (
                        <small>{slot.zoom_room_name}</small>
                      ) : <span className="text-muted">-</span>}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        {slot.booked_count > 0 && (
                          <button className="btn btn-outline-primary btn-sm py-0 px-1"
                            title="View Bookings"
                            onClick={() => toggleSlotBookings(slot.id)}>
                            <i className={`bi bi-chevron-${expandedSlotId === slot.id ? 'up' : 'down'}`}></i>
                          </button>
                        )}
                        <button className="btn btn-outline-secondary btn-sm py-0 px-1"
                          title="Update Capacity"
                          disabled={slot.status === 'cancelled'}
                          onClick={() => openCapModal(slot)}>
                          <i className="bi bi-people"></i>
                        </button>
                        <button className="btn btn-outline-danger btn-sm py-0 px-1"
                          title="Cancel Slot"
                          disabled={slot.status === 'cancelled'}
                          onClick={() => handleCancel(slot)}>
                          <i className="bi bi-x-circle"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedSlotId === slot.id && (
                    <tr>
                      <td colSpan="9" style={{ backgroundColor: '#f8f9fa', padding: '0.75rem 1rem' }}>
                        {bookingsLoading ? (
                          <small className="text-muted">Loading bookings...</small>
                        ) : slotBookings.length === 0 ? (
                          <small className="text-muted">No bookings found for this slot.</small>
                        ) : (
                          <div>
                            <small className="fw-semibold text-muted d-block mb-2">
                              <i className="bi bi-people-fill me-1"></i>
                              {slotBookings.length} Booking{slotBookings.length !== 1 ? 's' : ''}
                            </small>
                            <div className="d-flex flex-wrap gap-2">
                              {slotBookings.map(b => (
                                <div key={b.id} className="d-flex align-items-center gap-2 bg-white border rounded px-2 py-1"
                                  style={{ fontSize: '0.8125rem' }}>
                                  <span className="fw-medium">{b.candidate_name}</span>
                                  <span className={`badge bg-${
                                    b.status === 'confirmed' ? 'success' :
                                    b.status === 'pending' ? 'warning' :
                                    b.status === 'cancelled' ? 'secondary' : 'danger'
                                  }`} style={{ fontSize: '0.65rem' }}>
                                    {b.status}
                                  </span>
                                  {b.round && (
                                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                      {b.round === 'round_1' ? 'R1' : 'R2'}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
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

      {/* Add Slot Modal */}
      {showModal && (
        <div className="modal-backdrop-custom" onClick={() => setShowModal(false)}>
          <div className="modal-content-custom" style={{maxWidth:'520px'}}
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-3">
              <span className="fl-badge" style={{fontSize:'0.6rem'}}>ACTION PANEL</span>
              <div className="d-flex align-items-center justify-content-between mt-1">
                <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-calendar-plus" style={{color:'var(--primary)'}}></i>
                  Add Interview Slot
                </h5>
                <button className="btn btn-link text-muted p-0" onClick={() => setShowModal(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>

            {formError && (
              <div className="alert alert-danger py-2" style={{fontSize:'0.8125rem'}}>
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSlot}>
              <div className="mb-3">
                <label className="form-label form-label-sm">
                  Location <span className="text-danger">*</span>
                </label>
                <select className="form-select form-select-sm" name="location"
                  value={form.location} onChange={handleFormChange} required>
                  <option value="">Select location...</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.city})</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label form-label-sm">
                  Hiring Manager <span className="text-danger">*</span>
                </label>
                <select className="form-select form-select-sm" name="hiring_manager"
                  value={form.hiring_manager} onChange={handleFormChange} required>
                  <option value="">{form.location ? 'Select hiring manager...' : 'Select location first'}</option>
                  {hiringManagers.map((h) => (
                    <option key={h.id} value={h.id}>{h.full_name || `${h.first_name} ${h.last_name}`}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label form-label-sm">
                  Date <span className="text-danger">*</span>
                </label>
                <input type="date" className="form-control form-control-sm" name="date"
                  value={form.date} onChange={handleFormChange} required />
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label form-label-sm">
                    Start Time <span className="text-danger">*</span>
                  </label>
                  <input type="time" className="form-control form-control-sm" name="start_time"
                    value={form.start_time} onChange={handleFormChange} required />
                </div>
                <div className="col-6">
                  <label className="form-label form-label-sm">
                    End Time <span className="text-danger">*</span>
                  </label>
                  <input type="time" className="form-control form-control-sm" name="end_time"
                    value={form.end_time} onChange={handleFormChange} required />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label form-label-sm">Max Capacity</label>
                <input type="number" className="form-control form-control-sm" name="max_capacity"
                  min="1" value={form.max_capacity} onChange={handleFormChange} />
              </div>

              <div className="mb-3">
                <label className="form-label form-label-sm">Zoom Room</label>
                <select className="form-select form-select-sm" name="zoom_account"
                  value={form.zoom_account} onChange={handleFormChange}>
                  <option value="">None</option>
                  {zoomRooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.room_name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label form-label-sm">Meeting Link (optional)</label>
                <input type="url" className="form-control form-control-sm" name="meeting_link"
                  placeholder="https://zoom.us/j/..." value={form.meeting_link}
                  onChange={handleFormChange} />
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                  disabled={submitting}>
                  <i className="bi bi-plus-circle"></i>
                  {submitting ? 'Adding...' : 'Add Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Capacity Modal */}
      {capSlot && (
        <div className="modal-backdrop-custom" onClick={() => setCapSlot(null)}>
          <div className="modal-content-custom" style={{maxWidth:'380px'}}
            onClick={(e) => e.stopPropagation()}>
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-people" style={{color:'var(--primary)'}}></i>
              Update Capacity
            </h6>
            <p className="text-muted" style={{fontSize:'0.85rem'}}>
              {capSlot.location_name} &mdash; {capSlot.date} ({formatTime(capSlot.start_time)} - {formatTime(capSlot.end_time)})
            </p>
            <p style={{fontSize:'0.85rem'}}>
              Currently booked: <strong>{capSlot.booked_count}</strong> / {capSlot.max_capacity}
            </p>
            <div className="mb-3">
              <label className="form-label form-label-sm">New Max Capacity</label>
              <input type="number" className="form-control form-control-sm"
                min={capSlot.booked_count || 1} value={capValue}
                onChange={(e) => setCapValue(Number(e.target.value))} />
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setCapSlot(null)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" disabled={capSubmitting}
                onClick={handleCapUpdate}>
                {capSubmitting ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
