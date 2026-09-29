import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { verifyEmail, resendOtp } from '../services/authService.js';

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  const inputsRef = useRef([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let interval = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleDigitChange = (index, val) => {
    const cleanVal = val.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = cleanVal;
    setOtpDigits(updated);

    if (cleanVal && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const updated = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      updated[i] = pasted[i];
    }
    setOtpDigits(updated);
    inputsRef.current[Math.min(5, pasted.length)]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await verifyEmail(email.trim(), fullCode);

      if (res.success) {
        setSuccessMsg('Email verified successfully! Logging you in...');
        setTimeout(() => {
          login(res.token, res.user);
          navigate('/');
        }, 1000);
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setSuccessMsg('');

    try {
      const res = await resendOtp(email.trim(), 'email_verification');
      setSuccessMsg(res.message || 'A new 6-digit code has been sent.');
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">✉️</div>
          <h1 className="auth-title">Verify Your Email</h1>
          <p className="auth-subtitle">
            Enter the 6-digit verification code sent to{' '}
            <strong style={{ color: 'var(--text-main)' }}>{email || 'your email'}</strong>
          </p>
        </div>

        {error && <div className="auth-alert auth-alert-error">{error}</div>}
        {successMsg && <div className="auth-alert auth-alert-success">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!emailParam && (
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
              />
            </div>
          )}

          <div className="otp-container" onPaste={handlePaste}>
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputsRef.current[index] = el)}
                type="text"
                maxLength="1"
                className="otp-box"
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                autoFocus={index === 0}
              />
            ))}
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={isLoading || otpDigits.join('').length !== 6}
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: 20 }}>
          Didn't receive the email?{' '}
          {resendCooldown > 0 ? (
            <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>
              Resend in {resendCooldown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Resend Code
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
