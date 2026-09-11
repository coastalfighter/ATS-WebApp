import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import AlertMessage from '../components/common/AlertMessage';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <i className="bi bi-key-fill"></i>
        </div>
        <h2>Forgot Password</h2>
        <p className="subtitle">Enter your email to receive a reset link</p>

        {success ? (
          <div className="text-center">
            <div className="alert alert-success">
              <i className="bi bi-check-circle me-2"></i>
              If an account with that email exists, a password reset link has been sent.
            </div>
            <Link to="/login" className="btn btn-outline-primary mt-3">
              <i className="bi bi-arrow-left me-2"></i>
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <AlertMessage message={error} onClose={() => setError('')} />
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="bi bi-envelope"></i>
                    Send Reset Link
                  </>
                )}
              </button>
            </form>
            <div className="text-center mt-3">
              <Link to="/login" className="text-decoration-none">
                <i className="bi bi-arrow-left me-1"></i>
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
