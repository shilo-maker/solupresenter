import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Form, Button, Alert, Card, Container } from 'react-bootstrap';
import api from '../services/api';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setError('Please enter and confirm your new password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/reset-password', {
        token,
        password
      });

      // Auto-login after successful password reset
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        // Redirect to operator page - the AuthProvider will pick up the token
        window.location.href = '/operator';
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err.response?.data?.error || 'Failed to reset password. The link may be expired.');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <Container>
        <div className="d-flex justify-content-center">
          <Card style={{ width: '100%', maxWidth: '450px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
            <Card.Body className="p-4">
              <div className="text-center mb-4">
                <h1 className="h3 mb-2" style={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 'bold'
                }}>
                  Create New Password
                </h1>
                <p className="text-muted">
                  Enter your new password below.
                </p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || !token}
                    required
                    autoFocus
                    minLength={6}
                  />
                  <Form.Text className="text-muted">
                    Must be at least 6 characters
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Confirm Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading || !token}
                    required
                    minLength={6}
                  />
                </Form.Group>

                <Button
                  type="submit"
                  className="w-100"
                  disabled={loading || !token}
                  style={{
                    background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                    border: 'none',
                    padding: '12px'
                  }}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </Form>

              <div className="text-center mt-4">
                <Link
                  to="/login"
                  style={{
                    color: '#14b8a6',
                    textDecoration: 'none',
                    fontWeight: '500'
                  }}
                >
                  Back to Login
                </Link>
              </div>
            </Card.Body>
          </Card>
        </div>
      </Container>
    </div>
  );
}

export default ResetPassword;
