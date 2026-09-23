import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell, AuthHeader, AuthField, EyeOffIcon, PrimaryButton, inputBoxClass, inputBoxStyle, MUTED, BRAND, INK } from '../components/auth/AuthShell';

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  const code = location.state?.code;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!email || !code) {
    return (
      <AuthShell>
        <AuthHeader />
        <div className="px-6 pb-8 text-center">
          <p className="text-sm mb-4" style={{ color: MUTED }}>
            No password reset in progress.
          </p>
          <Link to="/login" className="text-sm font-semibold" style={{ color: BRAND }}>
            Back to Login
          </Link>
        </div>
      </AuthShell>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, code, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthHeader />
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 pb-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-[28px] font-extrabold" style={{ color: INK }}>
            Set New Password
          </h1>
          <p className="text-[15px] leading-[1.5]" style={{ color: MUTED }}>
            Choose a new password for your account.
          </p>
        </div>

        <AuthField label="New Password">
          <div className="relative w-full">
            <input
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputBoxClass()}
              style={{ ...inputBoxStyle, paddingRight: 44 }}
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeOffIcon />
            </button>
          </div>
        </AuthField>

        <AuthField label="Confirm New Password">
          <div className="relative w-full">
            <input
              required
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputBoxClass()}
              style={{ ...inputBoxStyle, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              <EyeOffIcon />
            </button>
          </div>
        </AuthField>

        {error && <div className="text-sm text-red-700">{error}</div>}

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save New Password'}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
