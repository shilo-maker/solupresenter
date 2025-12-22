import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Form, Button, Alert, Card } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const navigate = useNavigate();
  const { register } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError(t('auth.passwordMismatch'));
    }

    if (password.length < 6) {
      return setError(t('auth.passwordTooShort'));
    }

    setLoading(true);

    const result = await register(email, password);

    if (result.success) {
      // Show verification message if email verification is required
      if (result.requiresVerification) {
        setRegisteredEmail(email);
        setShowVerificationMessage(true);
      } else {
        // Auto-login if no verification required
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <Card>
          <Card.Body>
            <div className="text-center mb-3">
              <img src="/new_cast_logo.png" alt="SoluCast Logo" style={{ maxWidth: '200px', height: 'auto' }} />
            </div>
            <h4 className="text-center mb-4">{t('auth.register')}</h4>

            {showVerificationMessage ? (
              <div>
                <Alert variant="success">
                  <Alert.Heading>{t('auth.checkYourEmail')}</Alert.Heading>
                  <p>
                    {t('auth.verificationLinkSent')} <strong>{registeredEmail}</strong>
                  </p>
                  <p>
                    {t('auth.verifyAccountComplete')}
                  </p>
                  <hr />
                  <p className="mb-0" style={{ fontSize: '0.9rem' }}>
                    {t('auth.didntReceiveEmail')}{' '}
                    <Link to="/login">{t('auth.returnToLogin')}</Link> {t('auth.requestNewVerification')}
                  </p>
                </Alert>
                <div className="text-center mt-3">
                  <Link to="/login" className="btn btn-primary">
                    {t('auth.goToLogin')}
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="email">
                <Form.Label>{t('auth.email')}</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="password">
                <Form.Label>{t('auth.password')}</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="confirmPassword">
                <Form.Label>{t('auth.confirmPassword')}</Form.Label>
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
                {loading ? t('auth.creatingAccount') : t('auth.register')}
              </Button>
            </Form>

            <div className="text-center mt-3">
              {t('auth.hasAccount')} <Link to="/login">{t('auth.login')}</Link>
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
