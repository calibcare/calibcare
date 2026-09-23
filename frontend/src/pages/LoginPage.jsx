import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell, AuthHeader, AuthField, EyeOffIcon, PrimaryButton, inputBoxClass, inputBoxStyle, MUTED, BRAND } from '../components/auth/AuthShell';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        navigate('/verify-code', { state: { email, purpose: 'register' } });
        return;
      }
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthHeader />
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6">
        <AuthField label="Email">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputBoxClass()}
            style={inputBoxStyle}
          />
        </AuthField>

        <AuthField label="Password">
          <div className="relative w-full">
            <input
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputBoxClass()}
              style={{ ...inputBoxStyle, paddingRight: 44 }}
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

        <div className="flex items-center justify-between w-full">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center"
              style={{ backgroundColor: rememberMe ? BRAND : '#FFFFFF', border: rememberMe ? 'none' : '1.5px solid #E2E8F0' }}
            >
              {rememberMe && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </span>
            <input type="checkbox" className="hidden" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            <span className="text-sm font-medium" style={{ color: MUTED }}>
              Remember me
            </span>
          </label>
          <Link to="/forgot-password" className="text-sm font-semibold" style={{ color: BRAND }}>
            Forgot password?
          </Link>
        </div>

        {error && <div className="text-sm text-red-700 -mt-2">{error}</div>}

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </PrimaryButton>
      </form>

      <div className="flex justify-center gap-1 p-6 text-sm">
        <span style={{ color: MUTED }}>Don't have an account?</span>
        <Link to="/register" className="font-bold" style={{ color: BRAND }}>
          Sign Up
        </Link>
      </div>
    </AuthShell>
  );
}
