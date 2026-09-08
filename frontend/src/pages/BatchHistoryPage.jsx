import { useState, useEffect } from 'react';
import { batchesAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';
import Pagination from '../components/common/Pagination';
import { formatDateTime } from '../utils/statusHelpers';

export default function BatchHistoryPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedBatch, setSelectedBatch] = useState(null);

  useEffect(() => { loadBatches(); }, [page]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const { data } = await batchesAPI.list({ page });
      setBatches(data.results || []);
      setTotalPages(Math.ceil((data.count || 0) / 25));
    } catch (err) {
      setError('Failed to load batches.');
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (id) => {
    try {
      const { data } = await batchesAPI.get(id);
      setSelectedBatch(data);
    } catch {
      setError('Failed to load batch details.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Upload Batch History</h1>
      </div>
      <AlertMessage message={error} onClose={() => setError('')} />

      {selectedBatch ? (
        <div>
          <button className="btn btn-outline-secondary btn-sm mb-3 d-flex align-items-center gap-1" onClick={() => setSelectedBatch(null)}>
            <i className="bi bi-arrow-left"></i> Back to list
          </button>
          <div className="table-container p-3 mb-3">
            <h6>Batch #{selectedBatch.id} - {selectedBatch.file_name}</h6>
            <div className="row g-3 mt-2">
              <div className="col-md-2"><strong>Total:</strong> {selectedBatch.total_rows}</div>
              <div className="col-md-2"><strong>Imported:</strong> {selectedBatch.imported_count}</div>
              <div className="col-md-2"><strong>Duplicates:</strong> {selectedBatch.duplicate_count}</div>
              <div className="col-md-2"><strong>Invalid:</strong> {selectedBatch.invalid_count}</div>
              <div className="col-md-2"><strong>Status:</strong> <span className={`badge bg-${selectedBatch.status === 'completed' ? 'success' : selectedBatch.status === 'failed' ? 'danger' : 'warning'}`}>{selectedBatch.status}</span></div>
              <div className="col-md-2"><strong>By:</strong> {selectedBatch.uploaded_by_name}</div>
            </div>
          </div>
          {selectedBatch.row_errors && selectedBatch.row_errors.length > 0 && (
            <div className="table-container">
              <div className="p-3 border-bottom"><h6 className="mb-0">Row Errors</h6></div>
              <table className="table table-sm">
                <thead><tr><th>Row</th><th>Type</th><th>Message</th></tr></thead>
                <tbody>
                  {selectedBatch.row_errors.map((e, i) => (
                    <tr key={i}><td>{e.row_number}</td><td>{e.error_type}</td><td>{e.error_message}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : loading ? <LoadingSpinner /> : (
        <>
          <div className="table-container">
            <table className="table table-hover table-sm">
              <thead><tr><th>#</th><th>File</th><th>Uploaded By</th><th>Total</th><th>Imported</th><th>Duplicates</th><th>Invalid</th><th>Status</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr><td colSpan="10" className="text-center text-muted py-4">No upload batches found.</td></tr>
                ) : batches.map((b) => (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td>{b.file_name}</td>
                    <td>{b.uploaded_by_name || '-'}</td>
                    <td>{b.total_rows}</td>
                    <td className="text-success">{b.imported_count}</td>
                    <td className="text-warning">{b.duplicate_count}</td>
                    <td className="text-danger">{b.invalid_count}</td>
                    <td><span className={`badge bg-${b.status === 'completed' ? 'success' : b.status === 'failed' ? 'danger' : 'warning'}`}>{b.status}</span></td>
                    <td>{formatDateTime(b.created_at)}</td>
                    <td><button className="btn btn-outline-primary btn-sm" onClick={() => viewDetails(b.id)}>Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3"><Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /></div>
        </>
      )}
    </div>
  );
}
