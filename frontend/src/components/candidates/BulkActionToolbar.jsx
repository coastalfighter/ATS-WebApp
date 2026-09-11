import { useState, useEffect } from 'react';
import { candidatesAPI, usersAPI } from '../../services/api';
import { STATUS_LABELS } from '../../utils/statusHelpers';

const freshStatuses = [
  'never_contacted', 'contacted', 'unanswered', 'not_interested',
  'asked_to_connect_later', 'wrong_number', 'invalid_contact',
  'duplicate', 'do_not_contact', 'follow_up_due', 'interested',
];

const pipelineStatuses = [
  'interested', 'screening_scheduled', 'screening_completed',
  'interview_scheduled', 'interview_completed',
  'round2_scheduled', 'round2_completed',
  'observation', 'training', 'training_completed',
  'submitted', 'rejected', 'selected', 'offer_released',
  'joined', 'dropped', 'hired', 'fastgem_uploaded',
];

export default function BulkActionToolbar({ selectedIds, onComplete, bucket }) {
  const [action, setAction] = useState('');
  const [status, setStatus] = useState('');
  const [recruiterId, setRecruiterId] = useState('');
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    usersAPI.getRecruiters({ active_only: true })
      .then(({ data }) => setRecruiters(Array.isArray(data) ? data : data.results || []))
      .catch(() => {});
  }, []);

  if (selectedIds.length === 0) return null;

  const statusOptions = bucket === 'pipeline' ? pipelineStatuses : freshStatuses;

  const handleExecute = async () => {
    if (!action) return;
    setLoading(true);
    setResult(null);
    try {
      if (action === 'status' && status) {
        const { data } = await candidatesAPI.bulkUpdateStatus({
          candidate_ids: selectedIds,
          status,
          is_admin_override: true,
        });
        setResult(`Status updated: ${data.results?.filter(r => r.status === 'success').length || 0} success, ${data.results?.filter(r => r.status === 'error').length || 0} failed`);
      } else if (action === 'reassign' && recruiterId) {
        const { data } = await candidatesAPI.bulkReassign({
          candidate_ids: selectedIds,
          recruiter_id: parseInt(recruiterId),
        });
        setResult(`Reassigned ${data.reassigned} candidates.`);
      } else if (action === 'delete') {
        const { data } = await candidatesAPI.bulkDelete({
          candidate_ids: selectedIds,
        });
        setResult(`Deleted ${data.deleted} candidates.`);
      }
      setTimeout(() => {
        onComplete();
        setResult(null);
        setAction('');
        setStatus('');
        setRecruiterId('');
      }, 1500);
    } catch (err) {
      setResult(err.response?.data?.detail || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bulk-toolbar">
      <div className="bulk-toolbar-inner">
        <span className="bulk-count">{selectedIds.length} selected</span>
        <select className="form-select form-select-sm bulk-select" value={action}
          onChange={(e) => setAction(e.target.value)}>
          <option value="">Choose action...</option>
          <option value="status">Change Status</option>
          <option value="reassign">Reassign</option>
          <option value="delete">Delete</option>
        </select>

        {action === 'status' && (
          <select className="form-select form-select-sm bulk-select" value={status}
            onChange={(e) => setStatus(e.target.value)}>
            <option value="">Select status...</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
            ))}
          </select>
        )}

        {action === 'reassign' && (
          <select className="form-select form-select-sm bulk-select" value={recruiterId}
            onChange={(e) => setRecruiterId(e.target.value)}>
            <option value="">Select recruiter...</option>
            {recruiters.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name || `${r.first_name} ${r.last_name}`}</option>
            ))}
          </select>
        )}

        <button className="btn btn-primary btn-sm" onClick={handleExecute}
          disabled={loading || !action || (action === 'status' && !status) || (action === 'reassign' && !recruiterId)}>
          {loading ? 'Processing...' : 'Apply'}
        </button>

        {result && <span className="bulk-result">{result}</span>}
      </div>
    </div>
  );
}
