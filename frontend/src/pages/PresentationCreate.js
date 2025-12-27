import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PresentationEditor from '../components/presentation-editor/PresentationEditor';

function PresentationCreate() {
  const navigate = useNavigate();
  const [showEditor] = useState(true);

  const handleSave = (savedPresentation) => {
    navigate(`/presentations/${savedPresentation.id}`);
  };

  const handleClose = () => {
    navigate('/presentations');
  };

  return (
    <>
      <PresentationEditor
        show={showEditor}
        onHide={handleClose}
        presentation={null}
        onSave={handleSave}
      />
    </>
  );
}

export default PresentationCreate;
