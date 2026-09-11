import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useNotifications from '../../hooks/useNotifications';
import NotificationPanel from './NotificationPanel';
import Toast from '../common/Toast';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [showPanel, setShowPanel] = useState(false);
  const {
    unreadCount, notifications, loading, newNotification,
    fetchNotifications, markRead, markAllRead, dismissToast,
  } = useNotifications();

  const handleToggle = useCallback(() => {
    if (!showPanel) fetchNotifications();
    setShowPanel(prev => !prev);
  }, [showPanel, fetchNotifications]);

  const handleNavigate = useCallback((link) => {
    navigate(link);
  }, [navigate]);

  return (
    <>
      <div className="notification-bell-wrapper">
        <button className="notification-bell-btn" onClick={handleToggle} title="Notifications">
          <i className="bi bi-bell"></i>
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
        <NotificationPanel
          show={showPanel}
          notifications={notifications}
          loading={loading}
          onClose={() => setShowPanel(false)}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onNavigate={handleNavigate}
        />
      </div>
      <Toast
        notification={newNotification}
        onDismiss={dismissToast}
        onNavigate={handleNavigate}
      />
    </>
  );
}
