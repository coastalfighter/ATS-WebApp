import { useEffect, useRef } from 'react';

export default function NotificationPanel({
  show, notifications, loading, onClose, onMarkRead, onMarkAllRead, onNavigate,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [show, onClose]);

  if (!show) return null;

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  };

  const categoryColors = {
    info: 'var(--primary)',
    warning: '#f59e0b',
    action: '#ef4444',
  };

  return (
    <div className="notification-panel" ref={panelRef}>
      <div className="notification-panel-header">
        <h6 className="mb-0">Notifications</h6>
        <button className="btn btn-sm btn-link p-0" onClick={onMarkAllRead}>
          Mark all read
        </button>
      </div>
      <div className="notification-panel-body">
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-4 text-muted" style={{ fontSize: '0.8rem' }}>
            No notifications
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`notification-item ${n.is_read ? 'read' : 'unread'}`}
              onClick={() => {
                if (!n.is_read) onMarkRead(n.id);
                if (n.link) onNavigate(n.link);
                onClose();
              }}
            >
              <div className="notification-dot" style={{
                background: n.is_read ? 'transparent' : (categoryColors[n.category] || 'var(--primary)'),
              }} />
              <div className="notification-content">
                <div className="notification-title">{n.title}</div>
                <div className="notification-message">{n.message}</div>
                <div className="notification-time">{formatTime(n.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
