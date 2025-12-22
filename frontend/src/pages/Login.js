import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Button, Alert, Card } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Validate inputs
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setError('');
    setResendSuccess(false);
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result && result.success) {
        navigate('/operator');
      } else if (result && result.requiresVerification) {
        setRequiresVerification(true);
        setUnverifiedEmail(result.email);
        setError(result.error || 'Please verify your email before logging in');
        setLoading(false);
      } else {
        setError(result?.error || 'Invalid email or password');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    setError('');
    setResendSuccess(false);

    try {
      await api.post('/auth/resend-verification', { email: unverifiedEmail });
      setResendSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend verification email');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(-45deg, #0a0a0a, #1a1a2e, #2d2d2d, #404040, #2a2a3e, #1a1a1a)',
      backgroundSize: '400% 400%',
      animation: 'gradientShift 15s ease infinite',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <style>{`
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <Card>
          <Card.Body>
            <div className="text-center mb-4">
              <img src="/new_cast_logo.png" alt="SoluCast Logo" style={{ maxWidth: '150px', height: 'auto', marginBottom: '0.8rem' }} />
              <div style={{
                color: '#333',
                fontWeight: '600',
                fontSize: '1.5rem',
                letterSpacing: '1px',
                marginBottom: '0.2rem'
              }}>
                SoluCast
              </div>
              <div style={{
                color: '#666',
                fontWeight: '300',
                fontSize: '0.75rem',
                letterSpacing: '2px',
                textTransform: 'uppercase'
              }}>
                WORSHIP AS ONE
              </div>
            </div>
            <h4 className="text-center mb-4">{t('auth.login')}</h4>

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError('')}>
                <strong>{t('common.error')}:</strong> {error}
              </Alert>
            )}

            {resendSuccess && (
              <Alert variant="success">
                {t('auth.verificationSent')}
              </Alert>
            )}

            {requiresVerification && !resendSuccess && (
              <Alert variant="warning">
                <p className="mb-2">{t('auth.emailNotVerified')}</p>
                <Button
                  variant="warning"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={resendingEmail}
                >
                  {resendingEmail ? t('common.sending') : t('auth.resendVerification')}
                </Button>
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="email">
                <Form.Label>{t('auth.email')}</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="password">
                <Form.Label>{t('auth.password')}</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Form.Group>

              <div className="d-flex justify-content-end mb-3">
                <Link to="/forgot-password" style={{ fontSize: '0.9rem' }}>
                  {t('auth.forgotPassword')}
                </Link>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-100 mb-3"
                disabled={loading}
              >
                {loading ? t('auth.loggingIn') : t('auth.login')}
              </Button>
            </Form>

            <div className="text-center mt-3">
              {t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link>
            </div>

            <div className="text-center mt-2">
              <Link to="/viewer">{t('auth.joinAsViewer')}</Link>
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}

export default Login;
