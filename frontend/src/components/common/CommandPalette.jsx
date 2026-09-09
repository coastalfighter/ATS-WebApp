import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { group: 'Main', items: [
    { label: 'Dashboard', path: '/', icon: 'bi-grid-1x2-fill' },
  ]},
  { group: 'Candidates', items: [
    { label: 'Fresh Candidates', path: '/candidates/fresh', icon: 'bi-person-lines-fill' },
    { label: 'Pipeline Candidates', path: '/candidates/pipeline', icon: 'bi-funnel-fill' },
    { label: 'All Candidates', path: '/candidates/all', icon: 'bi-people-fill' },
    { label: 'Upload CSV/XLSX', path: '/candidates/upload', icon: 'bi-cloud-arrow-up-fill' },
    { label: 'Batch History', path: '/candidates/batches', icon: 'bi-clock-history' },
    { label: 'Duplicates', path: '/candidates/duplicates', icon: 'bi-files', adminOnly: true },
  ]},
  { group: 'Scheduling', items: [
    { label: 'Interviews', path: '/interviews', icon: 'bi-camera-video-fill' },
    { label: 'Calendar', path: '/calendar', icon: 'bi-calendar3' },
  ]},
  { group: 'Analytics', items: [
    { label: 'Reports', path: '/reports', icon: 'bi-bar-chart-line-fill', adminOnly: true },
  ]},
  { group: 'Administration', items: [
    { label: 'User Management', path: '/users', icon: 'bi-shield-lock-fill', adminOnly: true },
    { label: 'Settings', path: '/settings', icon: 'bi-gear-fill', adminOnly: true },
    { label: 'Audit Log', path: '/audit', icon: 'bi-journal-text', adminOnly: true },
    { label: 'Email Logs', path: '/email-logs', icon: 'bi-envelope', adminOnly: true },
  ]},
  { group: 'Account', items: [
    { label: 'Profile', path: '/profile', icon: 'bi-person-circle' },
    { label: 'Change Password', path: '/change-password', icon: 'bi-key-fill' },
  ]},
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { isAdminOrSubadmin } = useAuth();
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const allItems = NAV_ITEMS.flatMap(group =>
    group.items
      .filter(item => !item.adminOnly || isAdminOrSubadmin)
      .map(item => ({ ...item, group: group.group }))
  );

  const filtered = query
    ? allItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.group.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleSelect = (path) => {
    navigate(path);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex].path);
    }
  };

  if (!open) return null;

  let currentGroup = '';

  return (
    <div className="command-palette-backdrop" onClick={() => setOpen(false)}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette-input-wrapper">
          <i className="bi bi-search"></i>
          <input
            ref={inputRef}
            type="text"
            placeholder="Jump to a page..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="command-palette-results">
          {filtered.length === 0 ? (
            <div className="command-palette-empty">No matching page.</div>
          ) : filtered.map((item, i) => {
            const showGroup = item.group !== currentGroup;
            currentGroup = item.group;
            return (
              <div key={item.path}>
                {showGroup && <div className="command-palette-group">{item.group}</div>}
                <div
                  className={`command-palette-item ${i === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSelect(item.path)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <i className={`bi ${item.icon}`}></i>
                  <span>{item.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
