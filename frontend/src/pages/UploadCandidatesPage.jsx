import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidatesAPI, usersAPI } from '../services/api';
import AlertMessage from '../components/common/AlertMessage';

const INITIAL_FORM = {
  first_name: '', last_name: '', email: '', phone: '',
  source: '', assigned_recruiter: '', residential_location: '',
  job_market: '', notes: '',
};

export default function UploadCandidatesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bulk');

  // Bulk upload state
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Individual form state
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recruiters, setRecruiters] = useState([]);

  useEffect(() => {
    usersAPI.getRecruiters({ active_only: true })
      .then(({ data }) => setRecruiters(data))
      .catch(() => {});
  }, []);

  // --- Bulk Upload Handlers ---
  const handlePreview = async () => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await candidatesAPI.uploadPreview(formData);
      setPreview(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Preview failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await candidatesAPI.upload(formData);
      setResult(data);
      setPreview(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.csv') || dropped.name.endsWith('.xlsx'))) {
      setFile(dropped);
      setPreview(null);
      setResult(null);
    }
  };

  // --- Individual Form Handlers ---
  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError('First name and last name are required.');
      return;
    }
    if (!form.email.trim()) {
      setFormError('Email is required.');
      return;
    }
    if (!form.phone.trim()) {
      setFormError('Phone is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.assigned_recruiter) {
        delete payload.assigned_recruiter;
      } else {
        payload.assigned_recruiter = Number(payload.assigned_recruiter);
      }
      await candidatesAPI.create(payload);
      setFormSuccess(`${form.first_name} ${form.last_name} added successfully.`);
      setForm(INITIAL_FORM);
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.email?.[0] || 'Failed to add candidate.';
      setFormError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSubmitting(false);
    }
  };

  const validRows = preview?.preview_rows?.filter(r => !r._validation_status || r._validation_status === 'valid') || preview?.preview_rows || [];
  const duplicateRows = preview?.preview_rows?.filter(r => r._validation_status === 'duplicate') || [];
  const invalidRows = preview?.preview_rows?.filter(r => r._validation_status === 'invalid') || [];

  return (
    <div>
      <div className="page-header">
        <h1>Upload Candidates</h1>
        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={() => navigate('/candidates/batches')}>
          <i className="bi bi-clock-history"></i> Batch History
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="upload-tabs">
        <button className={`upload-tab ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}>
          <i className="bi bi-cloud-arrow-up"></i> Bulk Upload (CSV/XLSX)
        </button>
        <button className={`upload-tab ${activeTab === 'individual' ? 'active' : ''}`}
          onClick={() => setActiveTab('individual')}>
          <i className="bi bi-person-plus"></i> Add Individual
        </button>
      </div>

      {/* === BULK UPLOAD TAB === */}
      {activeTab === 'bulk' && (
        <>
          <AlertMessage message={error} onClose={() => setError('')} />

          {!result ? (
            <div className="row g-3">
              <div className="col-lg-8">
                {/* Upload Zone */}
                <div className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}>
                  <div className="upload-zone-content">
                    <div className="upload-icon">
                      <i className="bi bi-cloud-arrow-up-fill"></i>
                    </div>
                    {file ? (
                      <div>
                        <div className="d-flex align-items-center gap-2 justify-content-center mb-2">
                          <i className="bi bi-file-earmark-spreadsheet-fill" style={{fontSize:'1.25rem',color:'var(--success)'}}></i>
                          <span className="fw-medium">{file.name}</span>
                          <span className="text-muted small">({(file.size / 1024).toFixed(1)} KB)</span>
                          <button className="btn btn-link text-danger p-0" style={{fontSize:'0.8rem'}}
                            onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}>
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                        <div className="d-flex gap-2 justify-content-center">
                          <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                            onClick={(e) => { e.stopPropagation(); handlePreview(); }}
                            disabled={uploading}>
                            <i className="bi bi-eye"></i>
                            {uploading && !preview ? 'Analyzing...' : 'Preview & Validate'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-1 fw-medium">Drop your CSV or XLSX file here</p>
                        <p className="text-muted small mb-2">or click to browse</p>
                        <label className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 mx-auto" style={{width:'fit-content'}}>
                          <i className="bi bi-folder2-open"></i> Browse Files
                          <input type="file" className="d-none" accept=".csv,.xlsx"
                            onChange={(e) => { setFile(e.target.files[0]); setPreview(null); setResult(null); }} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview Table */}
                {preview && (
                  <div className="mt-3">
                    <div className="d-flex gap-3 mb-3 flex-wrap">
                      <div className="preview-stat">
                        <i className="bi bi-list-ol text-muted"></i>
                        <span><strong>{preview.total_rows}</strong> total rows</span>
                      </div>
                      <div className="preview-stat">
                        <i className="bi bi-check-circle-fill text-success"></i>
                        <span><strong>{validRows.length || preview.total_rows}</strong> valid</span>
                      </div>
                      {duplicateRows.length > 0 && (
                        <div className="preview-stat">
                          <i className="bi bi-files text-warning"></i>
                          <span><strong>{duplicateRows.length}</strong> duplicates</span>
                        </div>
                      )}
                      {invalidRows.length > 0 && (
                        <div className="preview-stat">
                          <i className="bi bi-exclamation-triangle-fill text-danger"></i>
                          <span><strong>{invalidRows.length}</strong> invalid</span>
                        </div>
                      )}
                    </div>

                    <div className="table-container">
                      <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                        <h6 className="mb-0 d-flex align-items-center gap-2">
                          <i className="bi bi-table" style={{color:'var(--primary)'}}></i>
                          Preview ({preview.total_rows} rows)
                        </h6>
                        <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                          onClick={handleUpload} disabled={uploading}>
                          <i className="bi bi-cloud-arrow-up"></i>
                          {uploading ? 'Importing...' : `Import ${validRows.length || preview.total_rows} rows`}
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr>
                              <th style={{width:'40px'}}>#</th>
                              {preview.headers.filter(h => !h.startsWith('_')).map((h, i) => <th key={i}>{h}</th>)}
                              <th style={{width:'90px'}}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(preview.preview_rows || []).map((row, i) => {
                              const status = row._validation_status || 'valid';
                              const errorMsg = row._validation_error || '';
                              return (
                                <tr key={i} className={status === 'invalid' ? 'table-danger' : status === 'duplicate' ? 'table-warning' : ''}>
                                  <td><small className="text-muted">{i + 1}</small></td>
                                  {preview.headers.filter(h => !h.startsWith('_')).map((h, j) => (
                                    <td key={j}><small>{row[h] || '-'}</small></td>
                                  ))}
                                  <td>
                                    <span className={`badge bg-${status === 'valid' ? 'success' : status === 'duplicate' ? 'warning' : 'danger'}`} style={{fontSize:'0.68rem'}}>
                                      {status}
                                    </span>
                                    {errorMsg && <div className="text-danger" style={{fontSize:'0.68rem'}}>{errorMsg}</div>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right column - Instructions */}
              <div className="col-lg-4">
                <div className="table-container p-3 mb-3">
                  <h6 className="d-flex align-items-center gap-2 mb-3">
                    <i className="bi bi-info-circle-fill" style={{color:'var(--primary)'}}></i> Instructions
                  </h6>
                  <div className="instruction-list">
                    <div className="instruction-item">
                      <div className="instruction-number">1</div>
                      <div>
                        <div className="fw-medium" style={{fontSize:'0.85rem'}}>Prepare your file</div>
                        <small className="text-muted">CSV or XLSX format with headers in the first row</small>
                      </div>
                    </div>
                    <div className="instruction-item">
                      <div className="instruction-number">2</div>
                      <div>
                        <div className="fw-medium" style={{fontSize:'0.85rem'}}>Required columns</div>
                        <small className="text-muted">first_name, last_name, email, phone</small>
                      </div>
                    </div>
                    <div className="instruction-item">
                      <div className="instruction-number">3</div>
                      <div>
                        <div className="fw-medium" style={{fontSize:'0.85rem'}}>Optional columns</div>
                        <small className="text-muted">alternate_phone, source, residential_location, job_market</small>
                      </div>
                    </div>
                    <div className="instruction-item">
                      <div className="instruction-number">4</div>
                      <div>
                        <div className="fw-medium" style={{fontSize:'0.85rem'}}>Preview & validate</div>
                        <small className="text-muted">Review data before importing. Duplicates are auto-detected.</small>
                      </div>
                    </div>
                    <div className="instruction-item">
                      <div className="instruction-number">5</div>
                      <div>
                        <div className="fw-medium" style={{fontSize:'0.85rem'}}>Auto-assignment</div>
                        <small className="text-muted">Candidates are assigned to recruiters via round-robin. All start in &ldquo;Fresh&rdquo; bucket.</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="table-container p-4">
              <div className="text-center mb-4">
                <div className="upload-success-icon">
                  <i className="bi bi-check-circle-fill"></i>
                </div>
                <h5 className="mt-3">Upload Complete</h5>
                <p className="text-muted">Your candidates have been imported successfully.</p>
              </div>
              <div className="row g-3 mb-4 justify-content-center">
                <div className="col-auto">
                  <div className="stat-card text-center" style={{minWidth:'100px'}}>
                    <div className="stat-value">{result.total_rows}</div>
                    <div className="stat-label">Total</div>
                  </div>
                </div>
                <div className="col-auto">
                  <div className="stat-card text-center stat-card-accent-success" style={{minWidth:'100px'}}>
                    <div className="stat-value" style={{color:'var(--success)'}}>{result.imported_count}</div>
                    <div className="stat-label">Imported</div>
                  </div>
                </div>
                <div className="col-auto">
                  <div className="stat-card text-center stat-card-accent-warning" style={{minWidth:'100px'}}>
                    <div className="stat-value" style={{color:'var(--warning)'}}>{result.duplicate_count}</div>
                    <div className="stat-label">Duplicates</div>
                  </div>
                </div>
                <div className="col-auto">
                  <div className="stat-card text-center stat-card-accent-danger" style={{minWidth:'100px'}}>
                    <div className="stat-value" style={{color:'var(--danger)'}}>{result.invalid_count}</div>
                    <div className="stat-label">Invalid</div>
                  </div>
                </div>
              </div>
              {result.row_errors && result.row_errors.length > 0 && (
                <div className="table-container mb-3">
                  <div className="p-3 border-bottom d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-danger"></i>
                    <h6 className="mb-0">Errors</h6>
                  </div>
                  <table className="table table-sm mb-0">
                    <thead><tr><th>Row</th><th>Type</th><th>Message</th></tr></thead>
                    <tbody>
                      {result.row_errors.map((e, i) => (
                        <tr key={i}><td>{e.row_number}</td><td><span className="badge bg-danger">{e.error_type}</span></td><td>{e.error_message}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="d-flex gap-2 justify-content-center">
                <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => navigate('/candidates/fresh')}>
                  <i className="bi bi-eye"></i> View Fresh Candidates
                </button>
                <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={() => { setFile(null); setResult(null); }}>
                  <i className="bi bi-arrow-repeat"></i> Upload Another
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* === INDIVIDUAL ADD TAB === */}
      {activeTab === 'individual' && (
        <div className="row g-3">
          <div className="col-lg-8">
            <div className="table-container p-4">
              <h6 className="d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-person-plus-fill" style={{color:'var(--primary)'}}></i>
                Add Individual Candidate
              </h6>

              <AlertMessage message={formError} onClose={() => setFormError('')} />
              {formSuccess && (
                <div className="alert alert-success d-flex align-items-center gap-2 py-2" style={{fontSize:'0.875rem'}}>
                  <i className="bi bi-check-circle-fill"></i> {formSuccess}
                  <button className="btn-close ms-auto" style={{fontSize:'0.65rem'}} onClick={() => setFormSuccess('')}></button>
                </div>
              )}

              <form onSubmit={handleFormSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">First Name <span className="text-danger">*</span></label>
                    <input type="text" className="form-control form-control-sm" name="first_name"
                      value={form.first_name} onChange={handleFormChange} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Last Name <span className="text-danger">*</span></label>
                    <input type="text" className="form-control form-control-sm" name="last_name"
                      value={form.last_name} onChange={handleFormChange} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Email <span className="text-danger">*</span></label>
                    <input type="email" className="form-control form-control-sm" name="email"
                      value={form.email} onChange={handleFormChange} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Phone <span className="text-danger">*</span></label>
                    <input type="tel" className="form-control form-control-sm" name="phone"
                      value={form.phone} onChange={handleFormChange} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Source</label>
                    <input type="text" className="form-control form-control-sm" name="source"
                      placeholder="e.g. LinkedIn, Referral, Naukri..."
                      value={form.source} onChange={handleFormChange} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Recruiter</label>
                    <select className="form-select form-select-sm" name="assigned_recruiter"
                      value={form.assigned_recruiter} onChange={handleFormChange}>
                      <option value="">Auto-assign (round robin)</option>
                      {recruiters.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.full_name || `${r.first_name} ${r.last_name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Residential Location</label>
                    <input type="text" className="form-control form-control-sm" name="residential_location"
                      placeholder="e.g. Mumbai, Delhi NCR..."
                      value={form.residential_location} onChange={handleFormChange} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Job Market</label>
                    <input type="text" className="form-control form-control-sm" name="job_market"
                      placeholder="e.g. IT, Healthcare, Finance..."
                      value={form.job_market} onChange={handleFormChange} />
                  </div>
                  <div className="col-12">
                    <label className="form-label form-label-sm">Notes</label>
                    <textarea className="form-control form-control-sm" name="notes" rows="3"
                      placeholder="Any additional notes about the candidate..."
                      value={form.notes} onChange={handleFormChange}></textarea>
                  </div>
                </div>

                <div className="d-flex gap-2 mt-4">
                  <button type="submit" className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                    disabled={submitting}>
                    <i className="bi bi-plus-circle"></i>
                    {submitting ? 'Adding...' : 'Add Candidate'}
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm"
                    onClick={() => { setForm(INITIAL_FORM); setFormError(''); setFormSuccess(''); }}>
                    Reset
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right column - Info */}
          <div className="col-lg-4">
            <div className="table-container p-3 mb-3">
              <h6 className="d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-info-circle-fill" style={{color:'var(--primary)'}}></i> Quick Add
              </h6>
              <div className="instruction-list">
                <div className="instruction-item">
                  <div className="instruction-number">1</div>
                  <div>
                    <div className="fw-medium" style={{fontSize:'0.85rem'}}>Required fields</div>
                    <small className="text-muted">First name, last name, email, and phone are mandatory</small>
                  </div>
                </div>
                <div className="instruction-item">
                  <div className="instruction-number">2</div>
                  <div>
                    <div className="fw-medium" style={{fontSize:'0.85rem'}}>Recruiter assignment</div>
                    <small className="text-muted">Pick a recruiter or leave blank for auto round-robin</small>
                  </div>
                </div>
                <div className="instruction-item">
                  <div className="instruction-number">3</div>
                  <div>
                    <div className="fw-medium" style={{fontSize:'0.85rem'}}>Duplicate check</div>
                    <small className="text-muted">System checks for duplicate email/phone before adding</small>
                  </div>
                </div>
                <div className="instruction-item">
                  <div className="instruction-number">4</div>
                  <div>
                    <div className="fw-medium" style={{fontSize:'0.85rem'}}>Fresh bucket</div>
                    <small className="text-muted">Candidate starts in &ldquo;Leads / Master Data&rdquo; as Never Contacted</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
