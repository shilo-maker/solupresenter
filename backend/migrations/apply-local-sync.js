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

  console.log('[migration] Checking local sync (fixing corrupted Hebrew text)...');

  const updates = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const songIds = Object.keys(updates);

  let updated = 0;
  let notFound = 0;
  let skipped = 0;

  for (const songId of songIds) {
    const song = await Song.findByPk(songId);
    if (!song) {
      notFound++;
      continue;
    }

    const localSlides = updates[songId];
    const prodSlides = song.slides || [];

    // Check if this song actually needs updating (compare originalText)
    let needsUpdate = false;
    for (let i = 0; i < localSlides.length; i++) {
      const prodText = (prodSlides[i] && prodSlides[i].originalText) || '';
      const localText = localSlides[i].originalText || '';
      if (prodText !== localText) {
        needsUpdate = true;
        break;
      }
    }
    if (localSlides.length !== prodSlides.length) {
      needsUpdate = true;
    }

    if (!needsUpdate) {
      skipped++;
      continue;
    }

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

  console.log('[migration] Local sync: ' + updated + ' updated, ' + skipped + ' already ok, ' + notFound + ' not found');
}

module.exports = applyLocalSync;
