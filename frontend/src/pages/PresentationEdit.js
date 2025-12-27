import React, { useState, useEffect, useCallback } from 'react';
import { Container, Spinner, Alert, Button } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import PresentationEditor from '../components/presentation-editor/PresentationEditor';

function PresentationEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [presentation, setPresentation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditor, setShowEditor] = useState(false);

  const fetchPresentation = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/presentations/${id}`);
      const pres = response.data.presentation;

      // Check permissions
      const userId = user?.id || user?._id;
      const isOwner = pres.createdById === userId;

      if (!isOwner && !isAdmin) {
        setError(t('presentations.noEditPermission'));
        return;
      }

      setPresentation(pres);
      setShowEditor(true);
    } catch (err) {
      console.error('Error fetching presentation:', err);
      setError(err.response?.data?.error || t('presentations.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [id, user, isAdmin, t]);

  useEffect(() => {
    fetchPresentation();
  }, [fetchPresentation]);

  const handleSave = (savedPresentation) => {
    navigate(`/presentations/${savedPresentation.id}`);
  };

  const handleClose = () => {
    navigate(`/presentations/${id}`);
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
        <Button onClick={() => navigate('/presentations')}>{t('presentations.backToList')}</Button>
      </Container>
    );
  }

  return (
    <>
      <PresentationEditor
        show={showEditor}
        onHide={handleClose}
        presentation={presentation}
        onSave={handleSave}
      />
    </>
  );
}

export default PresentationEdit;
