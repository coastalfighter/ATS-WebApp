import { useState } from 'react';
import { integrationsAPI } from '../../services/api';

export default function ClickToCallButton({ candidateId, phone }) {
  const [calling, setCalling] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  if (!phone) return null;

  const handleCall = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    setCalling(true);
    setError('');
    setStatus(null);
    try {
      const { data } = await integrationsAPI.initiateCall({ candidate_id: candidateId });
      setStatus(data.status || 'Initiated');
      setTimeout(() => setStatus(null), 8000);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Call failed';
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } finally {
      setCalling(false);
    }
  };

  return (
    <span className="click-to-call-wrapper">
      <button className="click-to-call-btn" onClick={handleCall} disabled={calling}
        title={`Call ${phone}`}>
        <i className={`bi ${calling ? 'bi-hourglass-split' : 'bi-telephone-outbound-fill'}`}></i>
      </button>
      {status && <span className="click-to-call-status success">{status}</span>}
      {error && <span className="click-to-call-status error">{error}</span>}
    </span>
  );
}
