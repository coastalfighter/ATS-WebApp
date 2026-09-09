import { useState, useEffect } from 'react';
import { candidatesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { STATUS_LABELS, getStatusBadgeClass } from '../../utils/statusHelpers';

export default function StatusUpdateModal({ candidate, onClose, onUpdated }) {
  const { isAdminOrSubadmin } = useAuth();
  const [statusOptions, setStatusOptions] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (candidate) {
      candidatesAPI.statusOptions({
        bucket: candidate.current_bucket,
        current_status: candidate.current_status,
      }).then(({ data }) => setStatusOptions(data)).catch(() => {});
    }
  }, [candidate]);

  const handleSubmit = async () => {
    if (!selectedStatus) return;
    if (!remarks.trim()) { setError('Remarks are required.'); return; }
    setLoading(true);
    setError('');
    try {
      await candidatesAPI.updateStatus(candidate.id, {
        status: selectedStatus,
        remarks,
        is_admin_override: isAdminOrSubadmin,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  if (!candidate) return null;

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-content-custom" onClick={(e) => e.stopPropagation()}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">Update Status</h6>
          <button className="btn-close" onClick={onClose}></button>
        </div>
        <p className="small text-muted mb-2">
          {candidate.first_name} {candidate.last_name} &mdash;
          Current: <span className={getStatusBadgeClass(candidate.current_status)}>
            {STATUS_LABELS[candidate.current_status]}
          </span>
        </p>
        {error && <div className="alert alert-danger py-1 small">{error}</div>}
        <div className="mb-3">
          <label className="form-label small">New Status</label>
          <select className="form-select form-select-sm" value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="">Select status...</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label small">Remarks <span className="text-danger">*</span></label>
          <textarea className="form-control form-control-sm" rows="2"
            placeholder="Enter remarks..." value={remarks}
            onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={handleSubmit}
            disabled={!selectedStatus || loading}>
            {loading ? 'Updating...' : 'Update'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
