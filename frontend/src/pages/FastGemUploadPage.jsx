import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fastgemAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import { formatDate } from '../utils/statusHelpers';

export default function FastGemUploadPage() {
  const navigate = useNavigate();
  const [eligible, setEligible] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    external_reference_id: '',
    full_name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    start_date: '',
    salary: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eligibleRes, uploadsRes] = await Promise.all([
        fastgemAPI.eligible(),
        fastgemAPI.list(),
      ]);
      setEligible(eligibleRes.data || []);
      setUploads(uploadsRes.data?.results || uploadsRes.data || []);
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCandidate = (c) => {
    setSelectedCandidate(c);
    setFormData({
      ...formData,
      full_name: `${c.first_name} ${c.last_name}`,
      email: c.email || '',
      phone: c.phone || '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setSubmitting(true);
    setError('');
    try {
      await fastgemAPI.create({
        candidate: selectedCandidate.id,
        upload_data: {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          position: formData.position,
          department: formData.department,
          start_date: formData.start_date,
          salary: formData.salary,
          notes: formData.notes,
        },
        external_reference_id: formData.external_reference_id,
      });
      setSuccess(`FastGem data uploaded for ${selectedCandidate.first_name} ${selectedCandidate.last_name}.`);
      setSelectedCandidate(null);
      setFormData({
        external_reference_id: '', full_name: '', email: '', phone: '',
        position: '', department: '', start_date: '', salary: '', notes: '',
      });
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload FastGem data.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>FastGem Upload</h1>
        <span className="badge bg-secondary">{eligible.length} eligible</span>
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="table-container">
            <div className="p-3 border-bottom d-flex align-items-center gap-2">
              <i className="bi bi-people-fill" style={{ color: 'var(--primary)' }}></i>
              <h6 className="mb-0">Hired Candidates</h6>
            </div>
            {eligible.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <i className="bi bi-inbox" style={{ fontSize: '2rem' }}></i>
                <p className="mt-2 mb-0">No candidates with "Hired" status.</p>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {eligible.map((c) => (
                  <button key={c.id}
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selectedCandidate?.id === c.id ? 'active' : ''}`}
                    onClick={() => handleSelectCandidate(c)}>
                    <div>
                      <div className="fw-medium">{c.first_name} {c.last_name}</div>
                      <small className={selectedCandidate?.id === c.id ? '' : 'text-muted'}>{c.email}</small>
                    </div>
                    <i className="bi bi-chevron-right"></i>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-7">
          {selectedCandidate ? (
            <div className="table-container p-3">
              <h6 className="mb-3">
                <i className="bi bi-cloud-arrow-up me-2" style={{ color: 'var(--primary)' }}></i>
                FastGem Data for {selectedCandidate.first_name} {selectedCandidate.last_name}
              </h6>
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Full Name</label>
                    <input className="form-control form-control-sm" value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">External Reference ID</label>
                    <input className="form-control form-control-sm" value={formData.external_reference_id}
                      onChange={(e) => setFormData({ ...formData, external_reference_id: e.target.value })}
                      placeholder="FastGem reference number" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control form-control-sm" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Phone</label>
                    <input className="form-control form-control-sm" value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Position</label>
                    <input className="form-control form-control-sm" value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Department</label>
                    <input className="form-control form-control-sm" value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-control form-control-sm" value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Salary</label>
                    <input className="form-control form-control-sm" value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Notes</label>
                    <textarea className="form-control form-control-sm" rows={3} value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                  </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                    disabled={submitting}>
                    <i className="bi bi-cloud-arrow-up"></i> {submitting ? 'Uploading...' : 'Upload to FastGem'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedCandidate(null)}>Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="table-container p-4 text-center text-muted">
              <i className="bi bi-arrow-left-circle" style={{ fontSize: '2rem' }}></i>
              <p className="mt-2 mb-0">Select a hired candidate to upload FastGem data.</p>
            </div>
          )}
        </div>
      </div>

      {uploads.length > 0 && (
        <div className="table-container mt-4">
          <div className="p-3 border-bottom d-flex align-items-center gap-2">
            <i className="bi bi-clock-history" style={{ color: 'var(--primary)' }}></i>
            <h6 className="mb-0">Upload History</h6>
          </div>
          <table className="table table-sm table-hover mb-0">
            <thead>
              <tr><th>Candidate</th><th>Reference</th><th>Status</th><th>Uploaded By</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id}>
                  <td className="fw-medium cursor-pointer" onClick={() => navigate(`/candidates/${u.candidate}`)}>
                    {u.candidate_name}
                  </td>
                  <td><small>{u.external_reference_id || '-'}</small></td>
                  <td>
                    <span className={`badge bg-${u.status === 'uploaded' ? 'success' : u.status === 'failed' ? 'danger' : 'warning'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td><small>{u.uploaded_by_name}</small></td>
                  <td><small>{formatDate(u.created_at)}</small></td>
                  <td>
                    <button className="btn btn-outline-primary btn-sm py-0 px-1"
                      onClick={() => navigate(`/candidates/${u.candidate}`)}>
                      <i className="bi bi-eye"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
