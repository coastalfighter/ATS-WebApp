import { useAuth } from '../../context/AuthContext';

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();

  return (
    <div className="topbar">
      <div className="d-flex align-items-center">
        <button
          className="btn btn-link text-dark d-md-none me-2 p-0"
          onClick={onToggleSidebar}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="text-muted d-none d-md-inline">Welcome back!</span>
      </div>
      <div className="d-flex align-items-center gap-3">
        <span className="text-dark fw-medium">
          {user?.full_name || user?.username}
        </span>
        <span className="badge bg-primary text-capitalize">{user?.role}</span>
        <button className="btn btn-outline-secondary btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}
