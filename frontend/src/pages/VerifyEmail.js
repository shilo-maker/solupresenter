import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Container, Card, Alert, Spinner } from 'react-bootstrap';
import api from '../services/api';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('Invalid verification link');
      setVerifying(false);
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      const response = await api.get(`/auth/verify-email/${token}`);

      // Store the token and redirect to dashboard
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }

      setSuccess(true);
      setVerifying(false);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.response?.data?.error || 'Failed to verify email. The link may be invalid or expired.');
      setVerifying(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        <Card>
          <Card.Body>
            <div className="text-center mb-4">
              <img src="/cast_logo.png" alt="SoluCast Logo" style={{ maxWidth: '200px', height: 'auto' }} />
            </div>

            {verifying && (
              <div className="text-center">
                <Spinner animation="border" role="status" variant="primary" className="mb-3">
                  <span className="visually-hidden">Verifying...</span>
                </Spinner>
                <h5>Verifying your email...</h5>
                <p className="text-muted">Please wait while we verify your email address.</p>
              </div>
            )}

            {!verifying && success && (
              <Alert variant="success">
                <Alert.Heading>Email Verified Successfully!</Alert.Heading>
                <p>
                  Your email has been verified. You will be redirected to the dashboard in a moment...
                </p>
                <hr />
                <p className="mb-0">
                  If you're not redirected automatically, <Link to="/dashboard">click here</Link>.
                </p>
              </Alert>
            )}

            {!verifying && error && (
              <div>
                <Alert variant="danger">
                  <Alert.Heading>Verification Failed</Alert.Heading>
                  <p>{error}</p>
                </Alert>

                <div className="text-center mt-3">
                  <Link to="/login" className="btn btn-primary me-2">
                    Go to Login
                  </Link>
                  <Link to="/register" className="btn btn-outline-secondary">
                    Register Again
                  </Link>
                </div>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}

export default VerifyEmail;
