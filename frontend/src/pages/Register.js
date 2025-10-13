import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Form, Button, Alert, Card } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const navigate = useNavigate();
  const { register, googleLogin } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setLoading(true);

    const result = await register(email, password);

    if (result.success) {
      // Email verification disabled - redirect directly to dashboard
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleGoogleLogin = () => {
    googleLogin();
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <Card>
          <Card.Body>
            <div className="text-center mb-3">
              <img src="/logo.png" alt="SoluCast Logo" style={{ maxWidth: '200px', height: 'auto' }} />
            </div>
            <h4 className="text-center mb-4">Register</h4>

            {showVerificationMessage ? (
              <div>
                <Alert variant="success">
                  <Alert.Heading>Check Your Email!</Alert.Heading>
                  <p>
                    We've sent a verification link to <strong>{registeredEmail}</strong>
                  </p>
                  <p>
                    Please click the link in the email to verify your account and complete registration.
                  </p>
                  <hr />
                  <p className="mb-0" style={{ fontSize: '0.9rem' }}>
                    Didn't receive the email? Check your spam folder or{' '}
                    <Link to="/login">return to login</Link> to request a new verification email.
                  </p>
                </Alert>
                <div className="text-center mt-3">
                  <Link to="/login" className="btn btn-primary">
                    Go to Login
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="password">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="confirmPassword">
                <Form.Label>Confirm Password</Form.Label>
                <Form.Control
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </Form.Group>

              <Button
                type="submit"
                variant="primary"
                className="w-100 mb-3"
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Register'}
              </Button>
            </Form>

            <hr />

            <Button
              variant="outline-danger"
              className="w-100 mb-3"
              onClick={handleGoogleLogin}
            >
              <i className="bi bi-google me-2"></i>
              Sign up with Google
            </Button>

            <div className="text-center mt-3">
              Already have an account? <Link to="/login">Login</Link>
            </div>
              </>
            )}
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}

export default Register;
