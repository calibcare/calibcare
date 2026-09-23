import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell, AuthField, ArrowLeftIcon, PrimaryButton, inputBoxClass, inputBoxStyle, MUTED, BRAND, INK } from '../components/auth/AuthShell';

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      navigate('/verify-code', { state: { email, purpose: 'reset' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex items-center gap-2 px-6 pt-4">
        <Link to="/login" className="flex items-center gap-2">
          <ArrowLeftIcon />
          <span className="text-sm font-semibold" style={{ color: BRAND }}>
            Back to Login
          </span>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8 px-6 pt-8 pb-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-[28px] font-extrabold" style={{ color: INK }}>
            Forgot Password
          </h1>
          <p className="text-[15px] leading-[1.5]" style={{ color: MUTED }}>
            Please enter your email address to reset your password. We'll send you a 6-digit verification code.
          </p>
        </div>

        <AuthField label="Email Address">
          <input
            required
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputBoxClass()}
            style={inputBoxStyle}
          />
        </AuthField>

        {error && <div className="text-sm text-red-700">{error}</div>}

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Continue'}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
