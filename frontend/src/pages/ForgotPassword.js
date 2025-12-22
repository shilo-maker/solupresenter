import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Button, Alert, Card, Container } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError(t('auth.emailRequired'));
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
      setError(err.response?.data?.error || t('common.unexpectedError'));
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
              <div className="mb-3">
                <Link to="/" style={{ textDecoration: 'none', color: '#666', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  ← {t('common.back')}
                </Link>
              </div>
              <div className="text-center mb-4">
                <h1 className="h3 mb-2" style={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 'bold'
                }}>
                  {t('auth.resetPassword')}
                </h1>
                <p className="text-muted">
                  {t('auth.resetPasswordDescription')}
                </p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}

              {success && (
                <Alert variant="success">
                  <strong>{t('auth.checkYourEmail')}</strong>
                  <p className="mb-0 mt-2">
                    {t('auth.resetEmailSent')}
                  </p>
                </Alert>
              )}

              {!success && (
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('auth.emailAddress')}</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder={t('auth.enterEmail')}
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
                    {loading ? t('common.sending') : t('auth.sendResetLink')}
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
                  {t('auth.backToLogin')}
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
