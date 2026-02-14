/**
 * Full sync: Replace production song data with local database.
 * Local is the source of truth for all fields:
 * title, author, originalLanguage, tags, slides (text, translations, verseTypes).
 *
 * This migration is idempotent - it compares and only updates if different.
 */
const fs = require('fs');
const path = require('path');

async function applyLocalSync(Song) {
  const dataPath = path.join(__dirname, 'local-sync-updates.json');

  if (!fs.existsSync(dataPath)) {
    console.log('[migration] local-sync-updates.json not found, skipping');
    return;
  }

  console.log('[migration] Full local sync starting...');

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

    const local = updates[songId];
    const localSlides = local.slides || [];
    const prodSlides = song.slides || [];

    // Check if anything differs
    var needsUpdate = false;

    // Compare metadata
    if (local.title && song.title !== local.title) needsUpdate = true;
    if (local.author !== undefined && (song.author || '') !== local.author) needsUpdate = true;
    if (local.originalLanguage && song.originalLanguage !== local.originalLanguage) needsUpdate = true;
    if (local.tags && JSON.stringify(song.tags || []) !== JSON.stringify(local.tags)) needsUpdate = true;

    // Compare slides
    if (localSlides.length !== prodSlides.length) {
      needsUpdate = true;
    } else {
      for (var i = 0; i < localSlides.length; i++) {
        var ls = localSlides[i];
        var ps = prodSlides[i] || {};
        if (ls.originalText !== (ps.originalText || '')) { needsUpdate = true; break; }
        if (ls.transliteration !== (ps.transliteration || '')) { needsUpdate = true; break; }
        if (ls.verseType !== (ps.verseType || 'Verse')) { needsUpdate = true; break; }
        if (JSON.stringify(ls.translations || {}) !== JSON.stringify(ps.translations || {})) { needsUpdate = true; break; }
      }
    }

    if (!needsUpdate) {
      skipped++;
      continue;
    }

    // Full replace: local is source of truth
    var updateFields = { slides: localSlides };
    if (local.title) updateFields.title = local.title;
    if (local.author !== undefined) updateFields.author = local.author;
    if (local.originalLanguage) updateFields.originalLanguage = local.originalLanguage;
    if (local.tags) updateFields.tags = local.tags;

    await song.update(updateFields);
    updated++;
  }

  console.log('[migration] Full sync: ' + updated + ' updated, ' + skipped + ' already ok, ' + notFound + ' not found');
}

module.exports = applyLocalSync;
