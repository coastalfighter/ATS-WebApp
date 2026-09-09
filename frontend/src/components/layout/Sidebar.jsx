import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ show, onClose }) {
  const { isAdminOrSubadmin } = useAuth();

  const linkClass = ({ isActive }) =>
    `sidebar-link ${isActive ? 'active' : ''}`;

  return (
    <>
      <div className={`sidebar ${show ? 'show' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <i className="bi bi-people-fill"></i>
          </div>
          ATS System
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section">Main</div>
          <NavLink to="/" className={linkClass} end onClick={onClose}>
            <i className="bi bi-grid-1x2-fill"></i> Dashboard
          </NavLink>

          <div className="sidebar-section">Candidates</div>
          <NavLink to="/candidates/fresh" className={linkClass} onClick={onClose}>
            <i className="bi bi-person-lines-fill"></i> Fresh Candidates
          </NavLink>
          <NavLink to="/candidates/pipeline" className={linkClass} onClick={onClose}>
            <i className="bi bi-funnel-fill"></i> Pipeline
          </NavLink>
          <NavLink to="/candidates/all" className={linkClass} onClick={onClose}>
            <i className="bi bi-people-fill"></i> All Candidates
          </NavLink>
          <NavLink to="/candidates/upload" className={linkClass} onClick={onClose}>
            <i className="bi bi-cloud-arrow-up-fill"></i> Upload CSV/XLSX
          </NavLink>
          <NavLink to="/candidates/batches" className={linkClass} onClick={onClose}>
            <i className="bi bi-clock-history"></i> Batch History
          </NavLink>
          {isAdminOrSubadmin && (
            <NavLink to="/candidates/duplicates" className={linkClass} onClick={onClose}>
              <i className="bi bi-files"></i> Duplicates
            </NavLink>
          )}

          <div className="sidebar-section">Scheduling</div>
          <NavLink to="/interviews" className={linkClass} onClick={onClose}>
            <i className="bi bi-camera-video-fill"></i> Interviews
          </NavLink>
          <NavLink to="/calendar" className={linkClass} onClick={onClose}>
            <i className="bi bi-calendar3"></i> Calendar
          </NavLink>

          {isAdminOrSubadmin && (
            <>
              <div className="sidebar-section">Analytics</div>
              <NavLink to="/reports" className={linkClass} onClick={onClose}>
                <i className="bi bi-bar-chart-line-fill"></i> Reports
              </NavLink>
            </>
          )}

          {isAdminOrSubadmin && (
            <>
              <div className="sidebar-section">Administration</div>
              <NavLink to="/users" className={linkClass} onClick={onClose}>
                <i className="bi bi-shield-lock-fill"></i> User Management
              </NavLink>
              <NavLink to="/settings" className={linkClass} onClick={onClose}>
                <i className="bi bi-gear-fill"></i> Settings
              </NavLink>
              <NavLink to="/audit" className={linkClass} onClick={onClose}>
                <i className="bi bi-journal-text"></i> Audit Log
              </NavLink>
              <NavLink to="/email-logs" className={linkClass} onClick={onClose}>
                <i className="bi bi-envelope"></i> Email Logs
              </NavLink>
            </>
          )}

          <div className="sidebar-section">Account</div>
          <NavLink to="/profile" className={linkClass} onClick={onClose}>
            <i className="bi bi-person-circle"></i> Profile
          </NavLink>
          <NavLink to="/change-password" className={linkClass} onClick={onClose}>
            <i className="bi bi-key-fill"></i> Change Password
          </NavLink>
        </nav>
      </div>
      {show && <div className="sidebar-overlay" onClick={onClose} />}
    </>
  );
}
