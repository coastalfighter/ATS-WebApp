import { useAuth } from '../../context/AuthContext';

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();

  const getInitials = () => {
    const first = user?.first_name?.charAt(0) || '';
    const last = user?.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || '?';
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="hamburger-btn" onClick={onToggleSidebar}>
          <i className="bi bi-list" style={{ fontSize: '1.5rem' }}></i>
        </button>
        <div className="topbar-greeting d-none d-md-block">
          Welcome back, <strong>{user?.first_name || user?.username}</strong>
        </div>
      </div>
      <div className="topbar-right">
        <div className="topbar-avatar">{getInitials()}</div>
        <div className="topbar-user-info d-none d-sm-flex">
          <span className="topbar-user-name">{user?.full_name || user?.username}</span>
          <span className="topbar-user-role">{user?.role}</span>
        </div>
        <div className="topbar-divider d-none d-sm-block"></div>
        <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={logout}>
          <i className="bi bi-box-arrow-right"></i>
          <span className="d-none d-md-inline">Logout</span>
        </button>
      </div>
    </div>
  );
}
