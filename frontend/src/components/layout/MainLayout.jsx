import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from '../common/CommandPalette';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    const handler = () => {
      try {
        setSidebarCollapsed(localStorage.getItem('sidebar_collapsed') === 'true');
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const handleCollapse = (val) => {
    setSidebarCollapsed(val);
  };

  return (
    <div className={sidebarCollapsed ? 'sidebar-is-collapsed' : ''}>
      <Sidebar show={sidebarOpen} onClose={() => setSidebarOpen(false)} onCollapseChange={handleCollapse} />
      <Topbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="main-content">
        <Outlet />
      </div>
      <CommandPalette />
    </div>
  );
}
