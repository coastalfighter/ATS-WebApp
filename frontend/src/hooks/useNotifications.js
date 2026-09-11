import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsAPI } from '../services/api';

const POLL_INTERVAL = 30000;

export default function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const prevCount = useRef(0);
  const [newNotification, setNewNotification] = useState(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await notificationsAPI.unreadCount();
      const count = data.count || 0;
      if (count > prevCount.current && prevCount.current > 0) {
        fetchLatest();
      }
      prevCount.current = count;
      setUnreadCount(count);
    } catch {
      // silent
    }
  }, []);

  const fetchLatest = useCallback(async () => {
    try {
      const { data } = await notificationsAPI.list({ is_read: false, page_size: 1 });
      const items = data.results || data;
      if (items.length > 0) {
        setNewNotification(items[0]);
        setTimeout(() => setNewNotification(null), 5000);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await notificationsAPI.list({ page_size: 20 });
      setNotifications(data.results || data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, []);

  const dismissToast = useCallback(() => setNewNotification(null), []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    notifications,
    loading,
    newNotification,
    fetchNotifications,
    markRead,
    markAllRead,
    dismissToast,
  };
}
