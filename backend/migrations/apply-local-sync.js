/**
 * Full sync: Replace production song data with local database.
 * Local is the source of truth for all fields.
 */
const fs = require('fs');
const path = require('path');

async function applyLocalSync(Song) {
  const dataPath = path.join(__dirname, 'local-sync-updates.json');

  if (!fs.existsSync(dataPath)) {
    console.log('[migration] local-sync-updates.json not found, skipping');
    return;
  }

  console.log('[migration] Full local sync v2 starting...');

  const updates = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const songIds = Object.keys(updates);
  console.log('[migration] Loaded ' + songIds.length + ' songs from local data');

  // Debug: check data format of first song
  var firstId = songIds[0];
  var firstData = updates[firstId];
  console.log('[migration] First song data keys: ' + Object.keys(firstData).join(', '));
  console.log('[migration] First song title: ' + (firstData.title || 'N/A'));
  console.log('[migration] First song slides count: ' + ((firstData.slides || []).length));

  var updated = 0;
  var notFound = 0;
  var skipped = 0;
  var errors = 0;

  for (var s = 0; s < songIds.length; s++) {
    var songId = songIds[s];
    var song;
    try {
      song = await Song.findByPk(songId);
    } catch (findErr) {
      console.error('[migration] Error finding song ' + songId + ': ' + findErr.message);
      errors++;
      continue;
    }

    if (!song) {
      notFound++;
      continue;
    }

    var local = updates[songId];
    var localSlides = local.slides || [];
    var prodSlides = song.slides || [];

    // Check if anything differs
    var needsUpdate = false;

    // Compare slide count
    if (localSlides.length !== prodSlides.length) {
      needsUpdate = true;
    }

    // Compare slide content if same length
    if (!needsUpdate) {
      for (var i = 0; i < localSlides.length; i++) {
        var ls = localSlides[i];
        var ps = prodSlides[i] || {};
        if ((ls.originalText || '') !== (ps.originalText || '')) { needsUpdate = true; break; }
        if ((ls.transliteration || '') !== (ps.transliteration || '')) { needsUpdate = true; break; }
        if ((ls.verseType || '') !== (ps.verseType || '')) { needsUpdate = true; break; }
        if (JSON.stringify(ls.translations || {}) !== JSON.stringify(ps.translations || {})) { needsUpdate = true; break; }
      }
    }

    // Compare metadata
    if (!needsUpdate && local.title && song.title !== local.title) needsUpdate = true;
    if (!needsUpdate && local.author !== undefined && (song.author || '') !== (local.author || '')) needsUpdate = true;

    if (!needsUpdate) {
      skipped++;
      continue;
    }

    // Log what we're updating for the 3 key songs
    if (localSlides.length !== prodSlides.length) {
      console.log('[migration] Updating ' + (local.title || songId) + ': ' + prodSlides.length + ' -> ' + localSlides.length + ' slides');
    }

    // Full replace
    try {
      var updateFields = { slides: localSlides };
      if (local.title) updateFields.title = local.title;
      if (local.author !== undefined) updateFields.author = local.author || null;
      if (local.originalLanguage) updateFields.originalLanguage = local.originalLanguage;
      if (local.tags) updateFields.tags = local.tags;

      await song.update(updateFields);
      updated++;
    } catch (updateErr) {
      console.error('[migration] Error updating ' + (local.title || songId) + ': ' + updateErr.message);
      errors++;
    }
  }

  console.log('[migration] Full sync complete: ' + updated + ' updated, ' + skipped + ' ok, ' + notFound + ' not found, ' + errors + ' errors');
}

module.exports = applyLocalSync;
