import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ show, onClose, onCollapseChange }) {
  const { isAdminOrSubadmin } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('sidebar_collapsed', collapsed); } catch {}
    onCollapseChange?.(collapsed);
  }, [collapsed]);

  const linkClass = ({ isActive }) =>
    `sidebar-link ${isActive ? 'active' : ''}`;

  return (
    <>
      <div className={`sidebar ${show ? 'show' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <i className="bi bi-people-fill"></i>
          </div>
          <span>ATS System</span>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section">Main</div>
          <NavLink to="/" className={linkClass} end onClick={onClose} title="Dashboard">
            <i className="bi bi-grid-1x2-fill"></i> <span>Dashboard</span>
          </NavLink>

          <div className="sidebar-section">Candidates</div>
          <NavLink to="/candidates/fresh" className={linkClass} onClick={onClose} title="Leads / Master Data">
            <i className="bi bi-person-lines-fill"></i> <span>Leads / Master Data</span>
          </NavLink>
          <NavLink to="/candidates/pipeline" className={linkClass} onClick={onClose} title="Booked Candidates">
            <i className="bi bi-bookmark-check-fill"></i> <span>Booked Candidates</span>
          </NavLink>
          <NavLink to="/candidates/all" className={linkClass} onClick={onClose} title="All Candidates">
            <i className="bi bi-people-fill"></i> <span>All Candidates</span>
          </NavLink>
          <NavLink to="/candidates/upload" className={linkClass} onClick={onClose} title="Upload CSV/XLSX">
            <i className="bi bi-cloud-arrow-up-fill"></i> <span>Upload CSV/XLSX</span>
          </NavLink>
          <NavLink to="/candidates/batches" className={linkClass} onClick={onClose} title="Batch History">
            <i className="bi bi-clock-history"></i> <span>Batch History</span>
          </NavLink>
          {isAdminOrSubadmin && (
            <NavLink to="/candidates/duplicates" className={linkClass} onClick={onClose} title="Duplicates">
              <i className="bi bi-files"></i> <span>Duplicates</span>
            </NavLink>
          )}

          <div className="sidebar-section">Scheduling</div>
          <NavLink to="/interviews" className={linkClass} onClick={onClose} title="Interviews">
            <i className="bi bi-camera-video-fill"></i> <span>Interviews</span>
          </NavLink>
          <NavLink to="/calendar" className={linkClass} onClick={onClose} title="Calendar">
            <i className="bi bi-calendar3"></i> <span>Calendar</span>
          </NavLink>
          <NavLink to="/heatmap" className={linkClass} onClick={onClose} title="HeatMap">
            <i className="bi bi-geo-alt-fill"></i> <span>HeatMap</span>
          </NavLink>
          <NavLink to="/call-logs" className={linkClass} onClick={onClose} title="Call Logs">
            <i className="bi bi-telephone-fill"></i> <span>Call Logs</span>
          </NavLink>

          {isAdminOrSubadmin && (
            <>
              <div className="sidebar-section">Analytics</div>
              <NavLink to="/reports" className={linkClass} onClick={onClose} title="Reports">
                <i className="bi bi-bar-chart-line-fill"></i> <span>Reports</span>
              </NavLink>
            </>
          )}

          {isAdminOrSubadmin && (
            <>
              <div className="sidebar-section">Administration</div>
              <NavLink to="/users" className={linkClass} onClick={onClose} title="User Management">
                <i className="bi bi-shield-lock-fill"></i> <span>User Management</span>
              </NavLink>
              <NavLink to="/settings" className={linkClass} onClick={onClose} title="Settings">
                <i className="bi bi-gear-fill"></i> <span>Settings</span>
              </NavLink>
              <NavLink to="/zoom-rooms" className={linkClass} onClick={onClose} title="Zoom Rooms">
                <i className="bi bi-grid-3x3-gap-fill"></i> <span>Zoom Rooms</span>
              </NavLink>
              <NavLink to="/audit" className={linkClass} onClick={onClose} title="Audit Log">
                <i className="bi bi-journal-text"></i> <span>Audit Log</span>
              </NavLink>
              <NavLink to="/email-logs" className={linkClass} onClick={onClose} title="Email Logs">
                <i className="bi bi-envelope"></i> <span>Email Logs</span>
              </NavLink>
            </>
          )}

          <div className="sidebar-section">Account</div>
          <NavLink to="/profile" className={linkClass} onClick={onClose} title="Profile">
            <i className="bi bi-person-circle"></i> <span>Profile</span>
          </NavLink>
          <NavLink to="/change-password" className={linkClass} onClick={onClose} title="Change Password">
            <i className="bi bi-key-fill"></i> <span>Change Password</span>
          </NavLink>
        </nav>
        <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <i className={`bi bi-chevron-${collapsed ? 'right' : 'left'}`}></i>
        </button>
      </div>
      {show && <div className="sidebar-overlay" onClick={onClose} />}
    </>
  );
}
