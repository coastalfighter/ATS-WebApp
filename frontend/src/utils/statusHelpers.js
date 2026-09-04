export const STATUS_LABELS = {
  never_contacted: 'Never Contacted',
  contacted: 'Contacted',
  unanswered: 'Unanswered',
  not_interested: 'Not Interested',
  asked_to_connect_later: 'Asked to Connect Later',
  wrong_number: 'Wrong Number',
  invalid_contact: 'Invalid Contact',
  duplicate: 'Duplicate',
  do_not_contact: 'Do Not Contact',
  follow_up_due: 'Follow-up Due',
  interested: 'Interested',
  screening_scheduled: 'Screening Scheduled',
  screening_completed: 'Screening Completed',
  interview_scheduled: 'Interview Scheduled',
  interview_completed: 'Interview Completed',
  submitted: 'Submitted',
  rejected: 'Rejected',
  selected: 'Selected',
  offer_released: 'Offer Released',
  joined: 'Joined',
  dropped: 'Dropped',
};

export const BUCKET_LABELS = {
  upload_queue: 'Upload Queue',
  fresh: 'Fresh Candidates',
  pipeline: 'Pipeline Candidates',
};

export function getStatusBadgeClass(status) {
  return `status-badge ${status}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
