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

    window.location.href = `tel:${phone}`;

    try {
      await integrationsAPI.logCall({ candidate_id: candidateId });
    } catch {}

    setStatus('Call initiated');
    setTimeout(() => { setStatus(null); setCalling(false); }, 5000);
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
