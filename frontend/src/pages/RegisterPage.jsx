import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell, AuthHeader, AuthField, EyeOffIcon, PrimaryButton, inputBoxClass, inputBoxStyle, MUTED, BRAND } from '../components/auth/AuthShell';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register({ full_name: form.full_name, email: form.email, password: form.password });
      navigate('/verify-code', { state: { email: form.email, purpose: 'register' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthHeader />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6">
        <AuthField label="Name">
          <input
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className={inputBoxClass()}
            style={inputBoxStyle}
          />
        </AuthField>

        <AuthField label="Email address">
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputBoxClass()}
            style={inputBoxStyle}
          />
        </AuthField>

        <AuthField label="Password">
          <div className="relative w-full">
            <input
              required
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
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

        <AuthField label="Confirm Password">
          <div className="relative w-full">
            <input
              required
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
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
          {loading ? 'Creating account…' : 'Create Account'}
        </PrimaryButton>
      </form>

      <div className="flex justify-center gap-1 p-6 text-sm">
        <span style={{ color: MUTED }}>Already have an account?</span>
        <Link to="/login" className="font-bold" style={{ color: BRAND }}>
          Sign In Here
        </Link>
      </div>
    </AuthShell>
  );
}
