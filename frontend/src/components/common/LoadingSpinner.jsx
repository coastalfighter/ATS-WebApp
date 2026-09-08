export default function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <div className="loading-container">
      <div className="spinner-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>{text}</span>
    </div>
  );
}
