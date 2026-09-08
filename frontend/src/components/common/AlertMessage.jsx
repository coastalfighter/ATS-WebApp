export default function AlertMessage({ type = 'danger', message, onClose }) {
  if (!message) return null;

  const iconMap = {
    danger: 'bi-exclamation-triangle-fill',
    success: 'bi-check-circle-fill',
    warning: 'bi-exclamation-circle-fill',
    info: 'bi-info-circle-fill',
  };

  return (
    <div className={`alert alert-${type} ${onClose ? 'alert-dismissible' : ''} d-flex align-items-center gap-2`} role="alert">
      <i className={`bi ${iconMap[type] || iconMap.danger}`}></i>
      <span>{message}</span>
      {onClose && (
        <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
      )}
    </div>
  );
}
