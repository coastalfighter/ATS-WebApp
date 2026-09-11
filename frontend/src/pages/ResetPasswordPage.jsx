import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import AlertMessage from '../components/common/AlertMessage';

export default function ResetPasswordPage() {
  const { uid, token } = useParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPasswordFromToken({
        uid,
        token,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const fieldErrors = err.response?.data;
      if (detail) {
        setError(detail);
      } else if (fieldErrors?.new_password) {
        setError(fieldErrors.new_password.join(' '));
      } else {
        setError('Failed to reset password. The link may have expired.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <i className="bi bi-shield-lock-fill"></i>
        </div>
        <h2>Reset Password</h2>
        <p className="subtitle">Enter your new password</p>

        {success ? (
          <div className="text-center">
            <div className="alert alert-success">
              <i className="bi bi-check-circle me-2"></i>
              Password has been reset successfully!
            </div>
            <Link to="/login" className="btn btn-primary mt-3">
              <i className="bi bi-box-arrow-in-right me-2"></i>
              Sign In
            </Link>
          </div>
        ) : (
          <>
            <AlertMessage message={error} onClose={() => setError('')} />
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
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
                    Resetting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    Reset Password
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
