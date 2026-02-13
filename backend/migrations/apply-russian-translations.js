/**
 * One-time migration: Apply Russian translations to all songs.
 * Reads translations from russian-translations.json and merges them
 * into each song's slides translations map.
 *
 * This migration is idempotent - it checks if already applied
 * and skips if so.
 */
const fs = require('fs');
const path = require('path');

async function applyRussianTranslations(Song) {
  const dataPath = path.join(__dirname, 'russian-translations.json');

  if (!fs.existsSync(dataPath)) {
    console.log('[migration] russian-translations.json not found, skipping');
    return;
  }

  // Check if already applied by sampling a song
  const sample = await Song.findOne({
    where: { isPublic: true },
    attributes: ['id', 'slides']
  });

  if (sample && sample.slides && sample.slides.length > 0) {
    const firstSlide = sample.slides[0];
    if (firstSlide.translations && firstSlide.translations.ru) {
      console.log('[migration] Russian translations already applied, skipping');
      return;
    }
  }

  console.log('[migration] Applying Russian translations...');

  const translations = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const songIds = Object.keys(translations);
  console.log('[migration] Songs to update: ' + songIds.length);

  let updated = 0;
  let notFound = 0;

  for (const songId of songIds) {
    const song = await Song.findByPk(songId);
    if (!song) {
      notFound++;
      continue;
    }

    const slideTranslations = translations[songId];
    const slides = song.slides || [];

    if (slideTranslations.length !== slides.length) {
      console.log('[migration] Slide count mismatch for ' + song.title + ': expected ' + slides.length + ', got ' + slideTranslations.length);
      continue;
    }

    // Merge translations into each slide
    const updatedSlides = slides.map(function(slide, i) {
      const newTranslations = Object.assign({}, slide.translations || {}, slideTranslations[i] || {});
      return Object.assign({}, slide, {
        translations: newTranslations
      });
    });

    await song.update({ slides: updatedSlides });
    updated++;
  }

  console.log('[migration] Russian translations applied: ' + updated + ' songs updated, ' + notFound + ' not found');
}

module.exports = applyRussianTranslations;
