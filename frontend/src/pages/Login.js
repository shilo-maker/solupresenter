import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Button, Alert, Card } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

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
            <h4 className="text-center mb-4">Login</h4>

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError('')}>
                <strong>Error:</strong> {error}
              </Alert>
            )}

            {resendSuccess && (
              <Alert variant="success">
                Verification email sent successfully! Please check your inbox.
              </Alert>
            )}

            {requiresVerification && !resendSuccess && (
              <Alert variant="warning">
                <p className="mb-2">Your email address hasn't been verified yet.</p>
                <Button
                  variant="warning"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={resendingEmail}
                >
                  {resendingEmail ? 'Sending...' : 'Resend Verification Email'}
                </Button>
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="password">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Form.Group>

              <Button
                type="submit"
                variant="primary"
                className="w-100 mb-3"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </Form>

            <div className="text-center mt-3">
              Don't have an account? <Link to="/register">Register</Link>
            </div>

            <div className="text-center mt-2">
              <Link to="/viewer">Join as Viewer</Link>
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}

export default Login;
