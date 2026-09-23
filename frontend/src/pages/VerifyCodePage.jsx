import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell, AuthHeader, PrimaryButton, MUTED, INK, BRAND, BORDER } from '../components/auth/AuthShell';

const RESEND_SECONDS = 59;

export function VerifyCodePage() {
  const { verifyEmail, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  const purpose = location.state?.purpose || 'register';

  const [digits, setDigits] = useState(Array(6).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  if (!email) {
    return (
      <AuthShell>
        <AuthHeader />
        <div className="px-6 pb-8 text-center">
          <p className="text-sm mb-4" style={{ color: MUTED }}>
            No verification in progress.
          </p>
          <Link to="/login" className="text-sm font-semibold" style={{ color: BRAND }}>
            Back to Login
          </Link>
        </div>
      </AuthShell>
    );
  }

  const code = digits.join('');

  function setDigitAt(i, value) {
    const next = [...digits];
    next[i] = value;
    setDigits(next);
  }

  function handleChange(i, e) {
    const value = e.target.value.replace(/\D/g, '').slice(-1);
    setDigitAt(i, value);
    if (value && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(6).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (code.length !== 6) {
      setError('Enter all 6 digits');
      return;
    }
    setLoading(true);
    try {
      if (purpose === 'register') {
        await verifyEmail(email, code);
        navigate('/dashboard');
      } else {
        // Password reset: the code is verified together with the new
        // password on the next screen (the backend's OTP store consumes a
        // code the moment it's checked, so there's no separate
        // "just verify, don't consume" step for reset).
        navigate('/reset-password', { state: { email, code } });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    try {
      await resendOtp(email, purpose);
      setSecondsLeft(RESEND_SECONDS);
      setDigits(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code');
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <AuthShell>
      <AuthHeader />
      <form onSubmit={handleSubmit} className="flex flex-col gap-8 px-6 pb-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-[28px] font-extrabold" style={{ color: INK }}>
            Verify your Code
          </h1>
          <p className="text-[15px] leading-[1.5]" style={{ color: MUTED }}>
            We've sent a 6-digit verification code to <span style={{ color: INK, fontWeight: 600 }}>{email}</span>.
          </p>
        </div>

        <div className="flex items-center justify-between w-full" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              value={d}
              onChange={(e) => handleChange(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              inputMode="numeric"
              maxLength={1}
              className="w-[46px] h-[46px] rounded-full text-center text-lg font-bold bg-white outline-none"
              style={{ border: `1.5px solid ${BRAND}`, color: INK }}
            />
          ))}
        </div>

        <div className="flex flex-col items-center gap-2 -mt-4">
          {secondsLeft > 0 ? (
            <p className="text-sm font-semibold text-center" style={{ color: MUTED }}>
              Resend code again in {mm}:{ss}
            </p>
          ) : (
            <button type="button" onClick={handleResend} className="text-sm font-semibold" style={{ color: BRAND }}>
              Resend code
            </button>
          )}
        </div>

        {error && <div className="text-sm text-red-700 text-center">{error}</div>}

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Verifying…' : 'Verification'}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
