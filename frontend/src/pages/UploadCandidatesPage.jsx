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

  return (
    <div>
      <div className="page-header">
        <h1>Upload Candidates</h1>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      {!result ? (
        <div className="row">
          <div className="col-md-8">
            <div className="table-container p-4">
              <div className="mb-3">
                <label className="form-label">Select CSV or XLSX file</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".csv,.xlsx"
                  onChange={(e) => { setFile(e.target.files[0]); setPreview(null); setResult(null); }}
                />
              </div>
              <div className="text-muted small mb-3">
                Required columns: first_name, last_name, email, phone<br/>
                Optional columns: alternate_phone, source
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-primary d-flex align-items-center gap-1" onClick={handlePreview}
                  disabled={!file || uploading}>
                  <i className="bi bi-eye"></i>
                  {uploading && !preview ? 'Loading...' : 'Preview'}
                </button>
                {preview && (
                  <button className="btn btn-primary d-flex align-items-center gap-1" onClick={handleUpload} disabled={uploading}>
                    <i className="bi bi-cloud-arrow-up"></i>
                    {uploading ? 'Uploading...' : `Import ${preview.total_rows} rows`}
                  </button>
                )}
              </div>
            </div>

            {preview && (
              <div className="table-container mt-3">
                <div className="p-3 border-bottom">
                  <h6 className="mb-0">Preview ({preview.total_rows} rows found)</h6>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>{preview.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(preview.preview_rows || []).map((row, i) => (
                        <tr key={i}>
                          {preview.headers.map((h, j) => <td key={j}>{row[h] || '-'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="col-md-4">
            <div className="table-container p-3">
              <h6>Instructions</h6>
              <ul className="small text-muted">
                <li>Upload CSV or XLSX files</li>
                <li>First row must be headers</li>
                <li>Required: first_name, last_name, email, phone</li>
                <li>Duplicate candidates are auto-detected</li>
                <li>Candidates are auto-assigned to recruiters via round-robin</li>
                <li>All imported candidates start in "Fresh" bucket</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="table-container p-4">
          <h5 className="text-success mb-3">Upload Complete</h5>
          <div className="row g-3 mb-4">
            <div className="col-md-2"><div className="stat-card text-center"><div className="stat-value">{result.total_rows}</div><div className="stat-label">Total Rows</div></div></div>
            <div className="col-md-2"><div className="stat-card text-center"><div className="stat-value text-success">{result.imported_count}</div><div className="stat-label">Imported</div></div></div>
            <div className="col-md-2"><div className="stat-card text-center"><div className="stat-value text-warning">{result.duplicate_count}</div><div className="stat-label">Duplicates</div></div></div>
            <div className="col-md-2"><div className="stat-card text-center"><div className="stat-value text-danger">{result.invalid_count}</div><div className="stat-label">Invalid</div></div></div>
            <div className="col-md-2"><div className="stat-card text-center"><div className="stat-value text-muted">{result.skipped_count}</div><div className="stat-label">Skipped</div></div></div>
          </div>
          {result.row_errors && result.row_errors.length > 0 && (
            <div>
              <h6>Errors</h6>
              <table className="table table-sm">
                <thead><tr><th>Row</th><th>Type</th><th>Message</th></tr></thead>
                <tbody>
                  {result.row_errors.map((e, i) => (
                    <tr key={i}><td>{e.row_number}</td><td>{e.error_type}</td><td>{e.error_message}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 d-flex gap-2">
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
