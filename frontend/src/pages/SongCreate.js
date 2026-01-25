import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Badge, Alert } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

function SongCreate() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState(searchParams.get('title') || '');
  const [author, setAuthor] = useState('');
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
  const [submitForApproval, setSubmitForApproval] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expressMode, setExpressMode] = useState(searchParams.get('express') !== 'false');
  const [expressText, setExpressText] = useState('');

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
    fetchTags();

    // Check if coming from SoluFlow with pre-filled lyrics
    if (searchParams.get('fromSoluflow') === 'true') {
      const lyrics = sessionStorage.getItem('newSongLyrics');
      if (lyrics) {
        setExpressText(lyrics);
        // Clear after reading
        sessionStorage.removeItem('newSongLyrics');
      }
    }
  }, [searchParams]);

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
    let lastVerseType = '';
    return slides.map(slide => {
      const lines = [];

      // Add verse type marker if it changed
      if (slide.verseType && slide.verseType !== lastVerseType) {
        lines.push(`[${slide.verseType}]`);
        lastVerseType = slide.verseType;
      }

      lines.push(slide.originalText);
      if (slide.transliteration) lines.push(slide.transliteration);
      if (slide.translation) lines.push(slide.translation);
      if (slide.translationOverflow) lines.push(slide.translationOverflow);
      return lines.join('\n');
    }).join('\n\n');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError(t('songs.enterTitleError'));
      return;
    }

    // If in express mode, parse the text first
    let slidesToSubmit = slides;
    if (expressMode) {
      slidesToSubmit = parseExpressText();
    }

    const validSlides = slidesToSubmit.filter(slide => slide.originalText.trim());
    if (validSlides.length === 0) {
      setError(t('songs.addSlideError'));
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/songs', {
        title: title.trim(),
        author: author.trim() || null,
        originalLanguage,
        slides: validSlides,
        tags,
        submitForApproval
      });

      const newSongId = response.data.song.id || response.data.song._id;

      alert(submitForApproval
        ? t('songs.songCreatedAndSubmitted')
        : t('songs.songCreated'));
      navigate(`/songs/${newSongId}`);
    } catch (error) {
      console.error('Error creating song:', error);
      setError(error.response?.data?.error || t('songs.failedToCreate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('songs.createNewSong')}</h2>
        <div>
          <Button variant="primary" className="me-2" onClick={() => navigate('/operator')}>
            {t('dashboard.operator')}
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate('/songs')}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Form onSubmit={handleSubmit}>
        <Row>
          <Col lg={8}>
            {/* Basic Information */}
            <Card className="mb-4">
              <Card.Header>
                <h5 className="mb-0">{t('songs.basicInfo')}</h5>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label>{t('songs.songTitle')} *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={t('songs.enterSongTitle')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t('songs.authorArtist')}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={t('songs.enterAuthor')}
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t('songs.originalLanguage')} *</Form.Label>
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
                    {t('songs.selectLanguageDesc')}
                  </Form.Text>
                </Form.Group>
              </Card.Body>
            </Card>

            {/* Slides */}
            <Card className="mb-4">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">{t('songs.slides')}</h5>
                <div>
                  <Button
                    size="sm"
                    variant={expressMode ? "outline-secondary" : "info"}
                    className="me-2"
                    onClick={toggleExpressMode}
                  >
                    {expressMode ? t('songs.switchToStandardForm') : t('songs.switchToExpressForm')}
                  </Button>
                  {!expressMode && (
                    <Button size="sm" variant="primary" onClick={addSlide}>
                      + {t('songs.addSlide')}
                    </Button>
                  )}
                </div>
              </Card.Header>
              <Card.Body>
                {expressMode ? (
                  <>
                    <Form.Text className="text-muted d-block mb-3">
                      <strong>{t('songs.expressMode')}:</strong> {t('songs.expressModeDesc')}<br/>
                      {t('songs.expressModeVerseTypes')}<br/>
                      {isTransliterationLanguage ? (
                        <>
                          {t('songs.expressModeLines')}<br/>
                          {t('songs.expressModeLine1')}<br/>
                          {t('songs.expressModeLine2')}<br/>
                          {t('songs.expressModeLine3')}<br/>
                          {t('songs.expressModeLine4')}
                        </>
                      ) : (
                        <>
                          {t('songs.expressModeSimple')}
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
                        <small><strong>{t('songs.slide')} {index + 1}</strong></small>
                        {slides.length > 1 && (
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => removeSlide(index)}
                          >
                            {t('songs.remove')}
                          </Button>
                        )}
                      </Card.Header>
                      <Card.Body>
                        <Form.Group className="mb-3">
                          <Form.Label>{t('songs.verseType')}</Form.Label>
                          <Form.Select
                            value={slide.verseType || ''}
                            onChange={(e) => updateSlide(index, 'verseType', e.target.value)}
                          >
                            <option value="">{t('songs.none')}</option>
                            <option value="Intro">{t('songs.intro')}</option>
                            <option value="Verse1">{t('songs.verse1')}</option>
                            <option value="Verse2">{t('songs.verse2')}</option>
                            <option value="Verse3">{t('songs.verse3')}</option>
                            <option value="Verse4">{t('songs.verse4')}</option>
                            <option value="PreChorus">{t('songs.preChorus')}</option>
                            <option value="Chorus">{t('songs.chorus')}</option>
                            <option value="Bridge">{t('songs.bridge')}</option>
                            <option value="Instrumental">{t('songs.instrumental')}</option>
                            <option value="Outro">{t('songs.outro')}</option>
                            <option value="Tag">{t('songs.tag')}</option>
                          </Form.Select>
                          <Form.Text className="text-muted">
                            {t('songs.verseTypeDesc')}
                          </Form.Text>
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>{isTransliterationLanguage ? t('songs.originalText') + ' *' : t('songs.lyrics') + ' *'}</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            placeholder={isTransliterationLanguage ? t('songs.enterOriginalText') : t('songs.enterLyrics')}
                            value={slide.originalText}
                            onChange={(e) => updateSlide(index, 'originalText', e.target.value)}
                            dir={isTransliterationLanguage ? 'rtl' : 'ltr'}
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>{isTransliterationLanguage ? t('songs.transliteration') : t('songs.lyricsContinued')}</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            placeholder={isTransliterationLanguage ? t('songs.enterTransliteration') : t('songs.additionalLyrics')}
                            value={slide.transliteration}
                            onChange={(e) => updateSlide(index, 'transliteration', e.target.value)}
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>{isTransliterationLanguage ? t('songs.translation') : t('songs.lyricsContinued')}</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            placeholder={isTransliterationLanguage ? t('songs.enterTranslation') : t('songs.additionalLyrics')}
                            value={slide.translation}
                            onChange={(e) => updateSlide(index, 'translation', e.target.value)}
                          />
                        </Form.Group>

                        <Form.Group>
                          <Form.Label>{isTransliterationLanguage ? t('songs.translationOverflow') : t('songs.lyricsContinued')}</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            placeholder={isTransliterationLanguage ? t('songs.additionalTranslation') : t('songs.additionalLyrics')}
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
                <h5 className="mb-0">{t('songs.tags')}</h5>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Control
                    type="text"
                    placeholder={t('songs.addTag')}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                  />
                  <Form.Text className="text-muted">
                    {t('songs.pressEnterToAdd')}
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
                    <Form.Label>{t('songs.suggestedTags')}</Form.Label>
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

            {/* Options */}
            <Card className="mb-4">
              <Card.Header>
                <h5 className="mb-0">{t('songs.visibility')}</h5>
              </Card.Header>
              <Card.Body>
                <Form.Check
                  type="checkbox"
                  id="submitForApproval"
                  label={t('songs.submitForApproval')}
                  checked={submitForApproval}
                  onChange={(e) => setSubmitForApproval(e.target.checked)}
                />
                <Form.Text className="text-muted">
                  {t('songs.adminWillReview')}
                </Form.Text>
              </Card.Body>
            </Card>

            {/* Submit Button */}
            <div className="d-grid gap-2">
              <Button
                variant="success"
                type="submit"
                size="lg"
                disabled={loading}
              >
                {loading ? t('common.creating') : t('songs.createSong')}
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => navigate('/songs')}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </Col>
        </Row>
      </Form>
    </Container>
  );
}

export default SongCreate;
