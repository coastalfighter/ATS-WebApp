import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidatesAPI } from '../services/api';
import AlertMessage from '../components/common/AlertMessage';

export default function UploadCandidatesPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

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
                {/* Summary Bar */}
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
                    <small className="text-muted">alternate_phone, source</small>
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
                    <small className="text-muted">Candidates are assigned to recruiters via round-robin. All start in "Fresh" bucket.</small>
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
    </div>
  );
}
