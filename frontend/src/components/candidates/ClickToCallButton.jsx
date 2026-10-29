import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { integrationsAPI, authAPI } from '../../services/api';

export default function ClickToCallButton({ candidateId, phone }) {
  const { user, updateUser } = useAuth();
  const [calling, setCalling] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  if (!phone) return null;

  const makeCall = async (fromNumber) => {
    setCalling(true);
    setError('');
    setStatus(null);
    try {
      const payload = { candidate_id: candidateId };
      if (fromNumber) payload.from_number = fromNumber;
      const { data } = await integrationsAPI.initiateCall(payload);
      setStatus(data.status || 'Initiated');
      setShowPhonePrompt(false);
      setTimeout(() => setStatus(null), 8000);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Call failed';
      if (msg.toLowerCase().includes('no caller phone') || msg.toLowerCase().includes('set your phone')) {
        setShowPhonePrompt(true);
        setError('');
      } else {
        setError(msg);
        setTimeout(() => setError(''), 5000);
      }
    } finally {
      setCalling(false);
    }
  };

  const handleCall = (e) => {
    e.stopPropagation();
    e.preventDefault();
    makeCall();
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const cleaned = phoneInput.trim();
    if (!cleaned) return;
    try {
      const { data } = await authAPI.updateProfile({ phone: cleaned });
      updateUser(data);
    } catch {}
    makeCall(cleaned);
  };

  if (showPhonePrompt) {
    return (
      <span className="click-to-call-wrapper" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handlePhoneSubmit} className="d-inline-flex align-items-center gap-1">
          <input
            type="tel"
            className="form-control form-control-sm"
            placeholder="Your phone #"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            style={{ width: '130px', fontSize: '0.75rem' }}
            autoFocus
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={calling}
            style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
            {calling ? '...' : 'Call'}
          </button>
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setShowPhonePrompt(false)}
            style={{ fontSize: '0.7rem' }}>
            <i className="bi bi-x"></i>
          </button>
        </form>
      </span>
    );
  }

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
