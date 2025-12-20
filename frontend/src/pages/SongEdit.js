import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Badge, Alert, Spinner, Toast, ToastContainer } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function SongEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [originalLanguage, setOriginalLanguage] = useState('he');
  const [slides, setSlides] = useState([{
    originalText: '',
    transliteration: '',
    translation: '',
    translationOverflow: '',
    verseType: ''
  }]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [error, setError] = useState('');
  const [isPersonalCopy, setIsPersonalCopy] = useState(false);
  const [expressMode, setExpressMode] = useState(false);
  const [expressText, setExpressText] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const [isPublic, setIsPublic] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const isAdmin = user?.role === 'admin';

  const languages = [
    { code: 'he', name: 'Hebrew (עברית)' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish (Español)' },
    { code: 'fr', name: 'French (Français)' },
    { code: 'de', name: 'German (Deutsch)' },
    { code: 'ru', name: 'Russian (Русский)' },
    { code: 'ar', name: 'Arabic (العربية)' },
    { code: 'other', name: 'Other' }
  ];

  // Check if language needs transliteration/translation structure (Hebrew, Arabic)
  const isTransliterationLanguage = originalLanguage === 'he' || originalLanguage === 'ar';

  useEffect(() => {
    fetchSong();
    fetchTags();
  }, [id]);

  const fetchSong = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/songs/${id}`);
      const song = response.data.song;

      console.log('Fetched song from API:', song);
      console.log('Raw slides from database:', song.slides);

      setTitle(song.title);
      setOriginalLanguage(song.originalLanguage);
      setIsPublic(song.isPublic || false);
      setIsPendingApproval(song.isPendingApproval || false);
      setIsOwner(song.createdById === user?.id || song.creator?.id === user?.id);
      const processedSlides = song.slides.length > 0 ? song.slides.map(slide => ({
        ...slide,
        verseType: slide.verseType || ''
      })) : [{
        originalText: '',
        transliteration: '',
        translation: '',
        translationOverflow: '',
        verseType: ''
      }];

      console.log('Processed slides with verseType:', processedSlides);
      setSlides(processedSlides);
      setTags(song.tags || []);
    } catch (error) {
      console.error('Error fetching song:', error);
      setError(error.response?.data?.error || 'Failed to load song');
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await api.get('/api/songs/meta/tags');
      setAvailableTags(response.data.tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const addSlide = () => {
    setSlides([...slides, {
      originalText: '',
      transliteration: '',
      translation: '',
      translationOverflow: '',
      verseType: ''
    }]);
  };

  const parseExpressText = () => {
    // Parse express text into slides
    // Format: [VerseType] marks apply to all following slides until next verse type
    // Each slide separated by blank line
    // Within each slide: line1=original, line2=transliteration, line3=translation, line4=translationOverflow
    const slideBlocks = expressText.split(/\n\s*\n/); // Split by blank lines
    let currentVerseType = '';

    const parsedSlides = slideBlocks
      .map(block => {
        const lines = block.split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length === 0) return null;

        // Check if first line is a verse type marker like [Verse1], [Chorus], etc.
        const verseTypeMatch = lines[0].match(/^\[(.+)\]$/);
        if (verseTypeMatch) {
          currentVerseType = verseTypeMatch[1];
          lines.shift(); // Remove the verse type line
          if (lines.length === 0) return null; // If only verse type marker, skip
        }

        return {
          originalText: lines[0] || '',
          transliteration: lines[1] || '',
          translation: lines[2] || '',
          translationOverflow: lines[3] || '',
          verseType: currentVerseType
        };
      })
      .filter(slide => slide !== null && slide.originalText);

    return parsedSlides.length > 0 ? parsedSlides : [{ originalText: '', transliteration: '', translation: '', translationOverflow: '', verseType: '' }];
  };

  const convertSlidesToExpressText = () => {
    // Convert current slides to express text format
    console.log('Converting slides to express text:', slides);
    let lastVerseType = '';
    const result = slides.map(slide => {
      const lines = [];

      // Add verse type marker if it changed
      if (slide.verseType && slide.verseType !== lastVerseType) {
        console.log(`Adding verse type marker: [${slide.verseType}]`);
        lines.push(`[${slide.verseType}]`);
        lastVerseType = slide.verseType;
      }

      lines.push(slide.originalText);
      if (slide.transliteration) lines.push(slide.transliteration);
      if (slide.translation) lines.push(slide.translation);
      if (slide.translationOverflow) lines.push(slide.translationOverflow);
      return lines.join('\n');
    }).join('\n\n');
    console.log('Converted express text:', result);
    return result;
  };

  const toggleExpressMode = () => {
    if (!expressMode) {
      // Switching TO express mode - convert slides to text
      setExpressText(convertSlidesToExpressText());
    } else {
      // Switching FROM express mode - parse text to slides
      const parsed = parseExpressText();
      setSlides(parsed);
    }
    setExpressMode(!expressMode);
  };

  const removeSlide = (index) => {
    if (slides.length > 1) {
      setSlides(slides.filter((_, i) => i !== index));
    }
  };

  const updateSlide = (index, field, value) => {
    const newSlides = [...slides];
    newSlides[index][field] = value;
    setSlides(newSlides);
  };

  const addTag = (tag) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a song title');
      return;
    }

    // If in express mode, parse the text first
    let slidesToSubmit = slides;
    if (expressMode) {
      slidesToSubmit = parseExpressText();
      console.log('Parsed slides from express mode:', slidesToSubmit);
    } else {
      console.log('Submitting slides from standard mode:', slides);
    }

    const validSlides = slidesToSubmit.filter(slide => slide.originalText.trim());
    if (validSlides.length === 0) {
      setError('Please add at least one slide with original text');
      return;
    }

    console.log('Final slides being submitted:', validSlides);
    console.log('First slide verseType:', validSlides[0].verseType);

    setSaving(true);

    try {
      const response = await api.put(`/api/songs/${id}`, {
        title: title.trim(),
        originalLanguage,
        slides: validSlides,
        tags,
        isPublic,
        isPendingApproval
      });

      if (response.data.message === 'Personal copy created') {
        setIsPersonalCopy(true);
        setToast({ show: true, message: 'A personal copy has been created since you were editing a public song', variant: 'info' });
        setTimeout(() => navigate(`/songs/${response.data.song._id}`), 1500);
      } else {
        setToast({ show: true, message: 'Song updated successfully!', variant: 'success' });
        setTimeout(() => navigate(`/songs/${id}`), 1500);
      }
    } catch (error) {
      console.error('Error updating song:', error);
      setError(error.response?.data?.error || 'Failed to update song');
    } finally {
      setSaving(false);
    }
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

  if (error && !title) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
        <Button onClick={() => navigate('/songs')}>Back to Songs</Button>
      </Container>
    );
  }

  return (
    <>
      {/* Toast Notification */}
      <ToastContainer
        position="top-center"
        className="p-3"
        style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}
      >
        <Toast
          show={toast.show}
          onClose={() => setToast({ ...toast, show: false })}
          delay={3000}
          autohide
          bg={toast.variant}
        >
          <Toast.Header closeButton={false}>
            <strong className="me-auto">{toast.variant === 'success' ? 'Success' : 'Info'}</strong>
          </Toast.Header>
          <Toast.Body className={toast.variant === 'success' || toast.variant === 'info' ? 'text-white' : ''}>
            {toast.variant === 'success' && '✓ '}{toast.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>

      <Container className="py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Edit Song</h2>
          <Button variant="outline-secondary" onClick={() => navigate(`/songs/${id}`)}>
            Cancel
          </Button>
        </div>

        {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {isPersonalCopy && (
        <Alert variant="info">
          Editing a public song creates a personal copy that you can modify freely.
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Row>
          <Col lg={8}>
            {/* Basic Information */}
            <Card className="mb-4">
              <Card.Header>
                <h5 className="mb-0">Basic Information</h5>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label>Song Title *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter song title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Original Language *</Form.Label>
                  <Form.Select
                    value={originalLanguage}
                    onChange={(e) => setOriginalLanguage(e.target.value)}
                    required
                  >
                    {languages.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Select the original language of the song for proper text rendering
                  </Form.Text>
                </Form.Group>
              </Card.Body>
            </Card>

            {/* Slides */}
            <Card className="mb-4">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Slides</h5>
                <div>
                  <Button
                    size="sm"
                    variant={expressMode ? "outline-secondary" : "info"}
                    className="me-2"
                    onClick={toggleExpressMode}
                  >
                    {expressMode ? 'Switch to Standard Form' : 'Switch to Express Form'}
                  </Button>
                  {!expressMode && (
                    <Button size="sm" variant="primary" onClick={addSlide}>
                      + Add Slide
                    </Button>
                  )}
                </div>
              </Card.Header>
              <Card.Body>
                {expressMode ? (
                  <>
                    <Form.Text className="text-muted d-block mb-3">
                      <strong>Express Mode:</strong> Separate slides with blank lines.<br/>
                      Use [Verse1], [Chorus], [Bridge], etc. to mark sections (applies to all following slides until next marker).<br/>
                      {isTransliterationLanguage ? (
                        <>
                          Within each slide:<br/>
                          Line 1 = Original text (required)<br/>
                          Line 2 = Transliteration (optional)<br/>
                          Line 3 = Translation (optional)<br/>
                          Line 4 = Translation overflow (optional)
                        </>
                      ) : (
                        <>
                          Each slide can have up to 4 lines of lyrics.
                        </>
                      )}
                    </Form.Text>
                    <Form.Group>
                      <Form.Control
                        as="textarea"
                        rows={20}
                        placeholder={isTransliterationLanguage
                          ? "Example:\n\n[Verse1]\nשָׁלוֹם עֲלֵיכֶם\nShalom Aleichem\nPeace be upon you\n\n[Chorus]\nמַלְאֲכֵי הַשָּׁרֵת\nMalachei HaShareit\nAngels of service"
                          : "Example:\n\n[Verse1]\nAmazing grace, how sweet the sound\nThat saved a wretch like me\n\n[Chorus]\nI once was lost, but now I'm found\nWas blind, but now I see"}
                        value={expressText}
                        onChange={(e) => setExpressText(e.target.value)}
                        dir={isTransliterationLanguage ? 'rtl' : 'ltr'}
                        style={{ fontFamily: 'monospace' }}
                      />
                    </Form.Group>
                  </>
                ) : (
                  slides.map((slide, index) => (
                  <Card key={index} className="mb-3" bg="light">
                    <Card.Header className="d-flex justify-content-between align-items-center py-2">
                      <small><strong>Slide {index + 1}</strong></small>
                      {slides.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => removeSlide(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </Card.Header>
                    <Card.Body>
                      <Form.Group className="mb-3">
                        <Form.Label>Verse Type</Form.Label>
                        <Form.Select
                          value={slide.verseType || ''}
                          onChange={(e) => updateSlide(index, 'verseType', e.target.value)}
                        >
                          <option value="">None</option>
                          <option value="Intro">Intro</option>
                          <option value="Verse1">Verse 1</option>
                          <option value="Verse2">Verse 2</option>
                          <option value="Verse3">Verse 3</option>
                          <option value="Verse4">Verse 4</option>
                          <option value="PreChorus">Pre-Chorus</option>
                          <option value="Chorus">Chorus</option>
                          <option value="Bridge">Bridge</option>
                          <option value="Instrumental">Instrumental</option>
                          <option value="Outro">Outro</option>
                          <option value="Tag">Tag</option>
                        </Form.Select>
                        <Form.Text className="text-muted">
                          Optional: Mark the type of this slide
                        </Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>{isTransliterationLanguage ? 'Original Text *' : 'Lyrics *'}</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          placeholder={isTransliterationLanguage ? "Enter original text" : "Enter lyrics"}
                          value={slide.originalText}
                          onChange={(e) => updateSlide(index, 'originalText', e.target.value)}
                          dir={isTransliterationLanguage ? 'rtl' : 'ltr'}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>{isTransliterationLanguage ? 'Transliteration' : 'Lyrics (continued)'}</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          placeholder={isTransliterationLanguage ? "Enter transliteration (optional)" : "Additional lyrics (optional)"}
                          value={slide.transliteration}
                          onChange={(e) => updateSlide(index, 'transliteration', e.target.value)}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>{isTransliterationLanguage ? 'Translation' : 'Lyrics (continued)'}</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          placeholder={isTransliterationLanguage ? "Enter translation (optional)" : "Additional lyrics (optional)"}
                          value={slide.translation}
                          onChange={(e) => updateSlide(index, 'translation', e.target.value)}
                        />
                      </Form.Group>

                      <Form.Group>
                        <Form.Label>{isTransliterationLanguage ? 'Translation Overflow' : 'Lyrics (continued)'}</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          placeholder={isTransliterationLanguage ? "Additional translation text (optional)" : "Additional lyrics (optional)"}
                          value={slide.translationOverflow}
                          onChange={(e) => updateSlide(index, 'translationOverflow', e.target.value)}
                        />
                      </Form.Group>
                    </Card.Body>
                  </Card>
                  ))
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4}>
            {/* Tags */}
            <Card className="mb-4">
              <Card.Header>
                <h5 className="mb-0">Tags</h5>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Control
                    type="text"
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                  />
                  <Form.Text className="text-muted">
                    Press Enter to add tags
                  </Form.Text>
                </Form.Group>

                {tags.length > 0 && (
                  <div className="mb-3">
                    {tags.map(tag => (
                      <Badge
                        key={tag}
                        bg="primary"
                        className="me-2 mb-2"
                        style={{ cursor: 'pointer' }}
                        onClick={() => removeTag(tag)}
                      >
                        {tag} ✕
                      </Badge>
                    ))}
                  </div>
                )}

                {availableTags.length > 0 && (
                  <>
                    <Form.Label>Suggested Tags</Form.Label>
                    <div>
                      {availableTags
                        .filter(tag => !tags.includes(tag))
                        .slice(0, 10)
                        .map(tag => (
                          <Badge
                            key={tag}
                            bg="secondary"
                            className="me-2 mb-2"
                            style={{ cursor: 'pointer' }}
                            onClick={() => addTag(tag)}
                          >
                            + {tag}
                          </Badge>
                        ))}
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>

            {/* Visibility Options - show for admins always, for owners when song is not public */}
            {(isAdmin || (isOwner && !isPublic)) && (
              <Card className="mb-4">
                <Card.Header>
                  <h5 className="mb-0">Visibility</h5>
                </Card.Header>
                <Card.Body>
                  {isAdmin ? (
                    <>
                      <Form.Check
                        type="switch"
                        id="makePublic"
                        label={isPublic ? "Public song (visible to all users)" : "Make this song public"}
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                      />
                      <Form.Text className="text-muted">
                        {isPublic
                          ? "Toggle off to make this song private"
                          : "Toggle on to make this song visible to all users"}
                      </Form.Text>
                      {isPublic && (
                        <Alert variant="success" className="mt-2 mb-0">
                          <small>This song is currently public</small>
                        </Alert>
                      )}
                    </>
                  ) : (
                    <>
                      <Form.Check
                        type="checkbox"
                        id="submitForApproval"
                        label="Submit for public approval"
                        checked={isPendingApproval}
                        onChange={(e) => setIsPendingApproval(e.target.checked)}
                      />
                      <Form.Text className="text-muted">
                        An admin will review this song for inclusion in the public database
                      </Form.Text>
                      {isPendingApproval && (
                        <Alert variant="info" className="mt-2 mb-0">
                          <small>This song is pending approval</small>
                        </Alert>
                      )}
                    </>
                  )}
                </Card.Body>
              </Card>
            )}

            {/* Submit Button */}
            <div className="d-grid gap-2">
              <Button
                variant="success"
                type="submit"
                size="lg"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => navigate(`/songs/${id}`)}
              >
                Cancel
              </Button>
            </div>
          </Col>
        </Row>
      </Form>
      </Container>
    </>
  );
}

export default SongEdit;
