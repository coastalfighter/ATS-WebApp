import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ show, onClose }) {
  const { isAdminOrSubadmin } = useAuth();

  const linkClass = ({ isActive }) =>
    `sidebar-link ${isActive ? 'active' : ''}`;

  return (
    <div className={`sidebar ${show ? 'show' : ''}`}>
      <div className="sidebar-brand">ATS System</div>
      <nav className="sidebar-nav">
        <div className="sidebar-section">Main</div>
        <NavLink to="/" className={linkClass} end onClick={onClose}>Dashboard</NavLink>

        <div className="sidebar-section">Candidates</div>
        <NavLink to="/candidates/fresh" className={linkClass} onClick={onClose}>Fresh Candidates</NavLink>
        <NavLink to="/candidates/pipeline" className={linkClass} onClick={onClose}>Pipeline</NavLink>
        <NavLink to="/candidates/upload" className={linkClass} onClick={onClose}>Upload CSV/XLSX</NavLink>
        <NavLink to="/candidates/batches" className={linkClass} onClick={onClose}>Batch History</NavLink>
        {isAdminOrSubadmin && (
          <NavLink to="/candidates/duplicates" className={linkClass} onClick={onClose}>Duplicates</NavLink>
        )}

        <div className="sidebar-section">Scheduling</div>
        <NavLink to="/interviews" className={linkClass} onClick={onClose}>Interviews</NavLink>

        {isAdminOrSubadmin && (
          <>
            <div className="sidebar-section">Analytics</div>
            <NavLink to="/reports" className={linkClass} onClick={onClose}>Reports</NavLink>
          </>
        )}

        {isAdminOrSubadmin && (
          <>
            <div className="sidebar-section">Administration</div>
            <NavLink to="/users" className={linkClass} onClick={onClose}>User Management</NavLink>
          </>
        )}

        <div className="sidebar-section">Account</div>
        <NavLink to="/profile" className={linkClass} onClick={onClose}>Profile</NavLink>
        <NavLink to="/change-password" className={linkClass} onClick={onClose}>Change Password</NavLink>
      </nav>
    </div>
  );
}
