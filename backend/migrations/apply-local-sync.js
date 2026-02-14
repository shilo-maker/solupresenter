/**
 * One-time migration: Sync song slide text from local database.
 * Fixes corrupted Hebrew characters in production while preserving
 * production-side translations (es, ru, cs, en).
 *
 * This migration is idempotent - it checks if corruption still exists.
 */
const fs = require('fs');
const path = require('path');

async function applyLocalSync(Song) {
  const dataPath = path.join(__dirname, 'local-sync-updates.json');

  if (!fs.existsSync(dataPath)) {
    console.log('[migration] local-sync-updates.json not found, skipping');
    return;
  }

  // Check if corruption still exists by sampling a known corrupted song
  const sample = await Song.findByPk('5443245e-04eb-4b58-9500-5229cc7b89d6');
  if (sample && sample.slides && sample.slides.length > 2) {
    const text = sample.slides[2].originalText || '';
    if (!text.includes('\uFFFD') && !text.includes('��')) {
      console.log('[migration] Local sync already applied (no corruption found), skipping');
      return;
    }
  }

  console.log('[migration] Applying local sync (fixing corrupted Hebrew text)...');

  const updates = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const songIds = Object.keys(updates);
  console.log('[migration] Songs to update: ' + songIds.length);

  let updated = 0;
  let notFound = 0;

  for (const songId of songIds) {
    const song = await Song.findByPk(songId);
    if (!song) {
      notFound++;
      continue;
    }

    const localSlides = updates[songId];
    const prodSlides = song.slides || [];

    // Merge: use local slide text but preserve production translations
    const mergedSlides = localSlides.map(function(localSlide, i) {
      const prodSlide = prodSlides[i] || {};
      // Merge translations: local translations + production translations (production wins for conflicts)
      const mergedTranslations = Object.assign(
        {},
        localSlide.translations || {},
        prodSlide.translations || {}
      );
      return Object.assign({}, localSlide, {
        translations: mergedTranslations
      });
    });

    await song.update({ slides: mergedSlides });
    updated++;
  }

  console.log('[migration] Local sync applied: ' + updated + ' songs updated, ' + notFound + ' not found');
}

module.exports = applyLocalSync;
