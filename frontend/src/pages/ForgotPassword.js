import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Button, Alert, Card, Container } from 'react-bootstrap';
import api from '../services/api';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
      setEmail('');
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err.response?.data?.error || 'An error occurred. Please try again.');
    } finally {
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
                  Reset Password
                </h1>
                <p className="text-muted">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}

              {success && (
                <Alert variant="success">
                  <strong>Check your email!</strong>
                  <p className="mb-0 mt-2">
                    If an account exists with that email, we've sent you a password reset link.
                    Please check your inbox and follow the instructions.
                  </p>
                </Alert>
              )}

              {!success && (
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email Address</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                      autoFocus
                    />
                  </Form.Group>

                  <Button
                    type="submit"
                    className="w-100"
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                      border: 'none',
                      padding: '12px'
                    }}
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </Form>
              )}

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

export default ForgotPassword;
