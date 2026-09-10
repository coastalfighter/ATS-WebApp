import { useState, useEffect, useRef } from 'react';
import { locationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';

const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

export default function HeatMapPage() {
  const { isAdminOrSubadmin } = useAuth();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [form, setForm] = useState({
    name: '', address: '', city: '', state: '', country: 'India',
    latitude: '', longitude: '',
  });

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const loadLocations = async () => {
    try {
      const { data } = await locationsAPI.list();
      setLocations(data.results || data || []);
    } catch {
      setError('Failed to load locations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLocations(); }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || !window.L) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = window.L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    const activeLocations = locations.filter(l => l.is_active);
    activeLocations.forEach(loc => {
      const interviewCount = loc.interview_count || 0;
      const size = Math.max(20, Math.min(50, 20 + interviewCount * 3));

      const icon = window.L.divIcon({
        className: 'heatmap-marker',
        html: `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:radial-gradient(circle,rgba(79,70,229,0.9),rgba(79,70,229,0.4));
          border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-size:${size > 30 ? '0.7rem' : '0.6rem'};font-weight:700;
        ">${interviewCount}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = window.L.marker([parseFloat(loc.latitude), parseFloat(loc.longitude)], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:160px">
            <strong>${loc.name}</strong><br/>
            <small>${loc.address}</small><br/>
            <small>${loc.city}${loc.state ? ', ' + loc.state : ''}</small><br/>
            <small><b>${interviewCount}</b> interviews</small>
          </div>
        `);

      marker.on('click', () => setSelectedLocation(loc));
      markersRef.current.push(marker);
    });

    if (activeLocations.length > 0) {
      const bounds = window.L.latLngBounds(
        activeLocations.map(l => [parseFloat(l.latitude), parseFloat(l.longitude)])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [leafletLoaded, locations]);

  const resetForm = () => {
    setForm({ name: '', address: '', city: '', state: '', country: 'India', latitude: '', longitude: '' });
    setShowForm(false);
    setEditingLocation(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      if (editingLocation) {
        await locationsAPI.update(editingLocation.id, form);
        setSuccess(`Location "${form.name}" updated.`);
      } else {
        await locationsAPI.create(form);
        setSuccess(`Location "${form.name}" added.`);
      }
      resetForm();
      loadLocations();
    } catch (err) {
      setError(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to save location.');
    }
  };

  const handleEdit = (loc) => {
    setForm({
      name: loc.name, address: loc.address, city: loc.city || '',
      state: loc.state || '', country: loc.country || 'India',
      latitude: loc.latitude, longitude: loc.longitude,
    });
    setEditingLocation(loc);
    setShowForm(true);
  };

  const handleDelete = async (loc) => {
    if (!confirm(`Delete location "${loc.name}"?`)) return;
    try {
      await locationsAPI.delete(loc.id);
      setSuccess(`Location "${loc.name}" deleted.`);
      loadLocations();
    } catch {
      setError('Failed to delete location.');
    }
  };

  const handleToggle = async (loc) => {
    try {
      await locationsAPI.toggleActive(loc.id);
      loadLocations();
    } catch {
      setError('Failed to toggle location status.');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h1>Interview Locations</h1>
        {isAdminOrSubadmin && (
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            onClick={() => { resetForm(); setShowForm(!showForm); }}>
            {showForm ? <><i className="bi bi-x-lg"></i> Cancel</> : <><i className="bi bi-plus-lg"></i> Add Location</>}
          </button>
        )}
      </div>

      <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
      <AlertMessage message={error} onClose={() => setError('')} />

      {showForm && (
        <div className="table-container p-3 mb-3">
          <h6 className="mb-3">{editingLocation ? 'Edit Location' : 'Add Location'}</h6>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Name</label>
                <input type="text" className="form-control form-control-sm" required
                  placeholder="e.g., Main Office"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Address</label>
                <input type="text" className="form-control form-control-sm" required
                  placeholder="Full address"
                  value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label">City</label>
                <input type="text" className="form-control form-control-sm"
                  value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label">State</label>
                <input type="text" className="form-control form-control-sm"
                  value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Latitude</label>
                <input type="number" step="any" className="form-control form-control-sm" required
                  placeholder="e.g., 19.0760"
                  value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Longitude</label>
                <input type="number" step="any" className="form-control form-control-sm" required
                  placeholder="e.g., 72.8777"
                  value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">
                <i className="bi bi-check-lg me-1"></i> {editingLocation ? 'Update' : 'Add Location'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="table-container" style={{ overflow: 'hidden' }}>
            <div ref={mapRef} style={{ height: '500px', width: '100%' }}></div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="table-container p-3" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <h6 className="mb-3">
              <i className="bi bi-geo-alt me-1"></i> Locations
              <span className="badge bg-secondary ms-2" style={{ fontSize: '0.65rem' }}>{locations.length}</span>
            </h6>
            {locations.length === 0 ? (
              <p className="text-muted small">No locations added yet.</p>
            ) : locations.map(loc => (
              <div key={loc.id}
                className={`p-2 mb-2 rounded cursor-pointer ${selectedLocation?.id === loc.id ? 'border border-primary' : ''}`}
                style={{ background: 'var(--bg-body)', fontSize: '0.85rem' }}
                onClick={() => {
                  setSelectedLocation(loc);
                  if (mapInstanceRef.current && window.L) {
                    mapInstanceRef.current.setView([parseFloat(loc.latitude), parseFloat(loc.longitude)], 14);
                  }
                }}>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-medium">{loc.name}</div>
                    <small className="text-muted">{loc.city}{loc.state ? `, ${loc.state}` : ''}</small>
                    <div>
                      <span className={`badge bg-${loc.is_active ? 'success' : 'secondary'} me-1`} style={{ fontSize: '0.6rem' }}>
                        {loc.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <small className="text-muted">{loc.interview_count || 0} interviews</small>
                    </div>
                  </div>
                  {isAdminOrSubadmin && (
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm p-0 border-0" onClick={(e) => { e.stopPropagation(); handleEdit(loc); }}>
                        <i className="bi bi-pencil text-primary" style={{ fontSize: '0.75rem' }}></i>
                      </button>
                      <button className="btn btn-sm p-0 border-0" onClick={(e) => { e.stopPropagation(); handleToggle(loc); }}>
                        <i className={`bi bi-${loc.is_active ? 'eye-slash' : 'eye'} text-warning`} style={{ fontSize: '0.75rem' }}></i>
                      </button>
                      <button className="btn btn-sm p-0 border-0" onClick={(e) => { e.stopPropagation(); handleDelete(loc); }}>
                        <i className="bi bi-trash text-danger" style={{ fontSize: '0.75rem' }}></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
