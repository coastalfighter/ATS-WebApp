import { useEffect } from 'react';

export default function Toast({ notification, onDismiss, onNavigate }) {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const categoryIcons = {
    info: 'bi-info-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    action: 'bi-bell-fill',
  };

  return (
    <div className="notification-toast" onClick={() => {
      if (notification.link) onNavigate?.(notification.link);
      onDismiss();
    }}>
      <div className="toast-icon">
        <i className={`bi ${categoryIcons[notification.category] || 'bi-bell-fill'}`}></i>
      </div>
      <div className="toast-body">
        <div className="toast-title">{notification.title}</div>
        <div className="toast-message">{notification.message}</div>
      </div>
      <button className="toast-close" onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
        <i className="bi bi-x"></i>
      </button>
    </div>
  );
}
