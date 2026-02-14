/**
 * MIDI File Generator
 *
 * Generates a standard MIDI Type 0 file from slide timestamps.
 * Each slide maps to a MIDI note (slide 0 = note 0/C-1, slide 1 = note 1/C#-1, etc.)
 * Note durations span from one slide's start to the next slide's start.
 */

const TICKS_PER_BEAT = 480;

/** Notes 0–59 are slide triggers, 60 is blank/clear, 61–65 are item actions, 96–127 are identity encoding */
export const SLIDE_NOTE_MAX = 59;
export const BLANK_NOTE = 60;
export const ACTIVATE_NOTE = 61;
export const PAUSE_NOTE = 62;
export const STOP_NOTE = 63;
export const LOOP_ON_NOTE = 64;
export const LOOP_OFF_NOTE = 65;
export const SONG_ID_NOTE_MIN = 96;

/** CC 3 carries the item type indicator (sent before identity notes) */
export const ITEM_TYPE_CC = 3;

/** Map item type strings to CC 3 values */
export const ITEM_TYPE_MAP: Record<string, number> = {
  song: 0, presentation: 1, media: 2, countdown: 3, bible: 4,
  youtube: 5, stopwatch: 6, clock: 7, announcement: 8, messages: 9, audioPlaylist: 10
};

/** Reverse map: CC 3 value → item type string */
export const ITEM_TYPE_REVERSE_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(ITEM_TYPE_MAP).map(([k, v]) => [v, k])
);

/**
 * Build a portable hash input from a song's title and lyrics.
 * Uses title + first two words of lyrics so that the same song on different
 * computers (with different database IDs) produces the same MIDI identity.
 */
export function getSongHashInput(title: string, slides?: Array<{ originalText?: string; [key: string]: any }>): string {
  const normalizedTitle = (title || '').trim().toLowerCase();
  let firstWords = '';
  if (slides) {
    for (const slide of slides) {
      const text = (slide.originalText || '').trim();
      if (text) {
        const words = text.split(/\s+/).filter(Boolean);
        firstWords = words.slice(0, 2).join(' ').toLowerCase();
        break;
      }
    }
  }
  return `${normalizedTitle}|${firstWords}`;
}

/**
 * Build a portable hash input for any setlist item type.
 * Falls through to getSongHashInput for song/bible types.
 */
export function getItemHashInput(itemType: string, item: any): string {
  switch (itemType) {
    case 'song':
    case 'bible':
      return getSongHashInput(item.title, item.slides);
    case 'presentation':
      return `pres|${(item.title || '').trim().toLowerCase()}`;
    case 'media': {
      const name = (item.mediaName || item.name || item.mediaPath || '').toLowerCase();
      return `media|${name}`;
    }
    case 'countdown':
      return `countdown|${item.countdownTime || item.time || ''}|${(item.countdownMessage || item.message || '').trim().toLowerCase()}`;
    case 'youtube':
      return `yt|${item.youtubeVideoId || item.videoId || ''}`;
    case 'stopwatch':
      return 'stopwatch';
    case 'clock':
      return 'clock';
    case 'announcement':
      return `announce|${(item.announcementText || item.text || '').slice(0, 30).trim().toLowerCase()}`;
    case 'messages':
      return `messages|${(item.messages || []).slice(0, 2).join('|').slice(0, 40).toLowerCase()}`;
    case 'audioPlaylist':
      return `audioPl|${(item.title || item.name || '').trim().toLowerCase()}`;
    default:
      return `${itemType}|${(item.title || item.name || '').trim().toLowerCase()}`;
  }
}

/**
 * FNV-1a hash of a string, canonicalized for order-independent MIDI encoding.
 *
 * The raw hash is split into two parts (for 2 MIDI notes). These parts are
 * sorted so that min comes first — this means the decoded hash is the same
 * regardless of which note the bridge receives first (DAWs can reorder
 * simultaneous MIDI events).
 *
 * Pass the output of getSongHashInput() for portable cross-computer hashes.
 */
export function songIdToMidiHash(input: string): number {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Reduce to unsigned 32-bit then mod into value space
  const raw = (hash >>> 0) % 16_516_096;
  // Split into two parts and canonicalize (sort so min is first)
  const a = Math.floor(raw / 4064);
  const b = raw % 4064;
  const minPart = Math.min(a, b);
  const maxPart = Math.max(a, b);
  return minPart * 4064 + maxPart;
}

/**
 * Encode a 24-bit song hash into 2 MIDI note descriptors (pitch 96–127, velocity 1–127).
 * Each note carries ~12 bits: 32 pitch values × 127 velocity values = 4064 combinations.
 */
export function encodeSongHash(hash: number): {
  note1: { pitch: number; velocity: number };
  note2: { pitch: number; velocity: number };
} {
  const highPart = Math.floor(hash / 4064);
  const lowPart = hash % 4064;

  return {
    note1: {
      pitch: 96 + Math.floor(highPart / 127),
      velocity: (highPart % 127) + 1,
    },
    note2: {
      pitch: 96 + Math.floor(lowPart / 127),
      velocity: (lowPart % 127) + 1,
    },
  };
}

/**
 * Decode 2 MIDI note descriptors back into a canonical song hash.
 * Notes are sorted by part value before decoding so the result is the same
 * regardless of which note arrived first.
 */
export function decodeSongHash(
  note1: { pitch: number; velocity: number },
  note2: { pitch: number; velocity: number }
): number {
  const part1 = (note1.pitch - 96) * 127 + (note1.velocity - 1);
  const part2 = (note2.pitch - 96) * 127 + (note2.velocity - 1);
  const minPart = Math.min(part1, part2);
  const maxPart = Math.max(part1, part2);
  return minPart * 4064 + maxPart;
}

/** Push a variable-length quantity directly into the target array */
function pushVLQ(target: number[], value: number): void {
  if (!isFinite(value) || isNaN(value) || value < 0) value = 0;
  value = Math.round(value);
  if (value < 0x80) {
    target.push(value);
    return;
  }
  // Build bytes in reverse order, then push in correct order
  const temp: number[] = [];
  temp.push(value & 0x7f);
  value >>= 7;
  while (value > 0) {
    temp.push((value & 0x7f) | 0x80);
    value >>= 7;
  }
  for (let i = temp.length - 1; i >= 0; i--) {
    target.push(temp[i]);
  }
}

export interface MidiSongPayload {
  title: string;
  slides: Array<{
    originalText?: string;
    transliteration?: string;
    translation?: string;
    translationOverflow?: string;
    verseType?: string;
  }>;
  author?: string;
  originalLanguage?: string;
  tags?: string[];
}

/** Extended payload that supports all setlist item types. Superset of MidiSongPayload. */
export interface MidiItemPayload extends MidiSongPayload {
  /** Item type — omitted for backward-compatible song payloads */
  itemType?: string;
  /** Per-item background media path */
  background?: string;
  /** Presentation slide data */
  presentationSlides?: any[];
  /** Quick mode data (prayer/sermon presentations) */
  quickModeData?: any;
  /** Media type for media items */
  mediaType?: string;
  /** Media file path */
  mediaPath?: string;
  /** Media duration in seconds */
  mediaDuration?: number;
  /** Media display name */
  mediaName?: string;
  /** Countdown time (HH:MM:SS string or seconds number) */
  countdownTime?: string | number;
  /** Countdown message */
  countdownMessage?: string;
  /** Announcement text */
  announcementText?: string;
  /** YouTube video ID */
  youtubeVideoId?: string;
  /** YouTube video title */
  youtubeTitle?: string;
  /** Messages list */
  messages?: string[];
  /** Messages interval in seconds */
  messagesInterval?: number;
  /** Audio playlist data */
  audioPlaylist?: { name: string; tracks: any[]; shuffle?: boolean };
  /** Bible book/chapter/verse data */
  bibleData?: any;
  /** Number of navigable slides/subtitles (for prayer presentations, this is subtitle count) */
  slideCount?: number;
}

export interface MidiNoteEntry {
  noteNumber: number;
  time: number;
}

/**
 * Generate a complete MIDI Type 0 file.
 *
 * @param notes - Array of { noteNumber, time } entries, sorted by time ascending
 * @param totalDuration - Total audio duration in seconds
 * @param bpm - Beats per minute (must match DAW project BPM)
 * @param songIdNotes - Optional 2-note song identity header (written at time 0 before slide notes)
 * @param itemTypeCC - Optional CC 3 value for item type (0=song, 1=presentation, etc.)
 * @returns Uint8Array containing the complete .mid binary
 */
export function generateMidiFile(
  notes: MidiNoteEntry[],
  totalDuration: number,
  bpm: number,
  songIdNotes?: Array<{ noteNumber: number; velocity: number }>,
  songPayload?: MidiSongPayload,
  itemTypeCC?: number
): Uint8Array {
  if (notes.length === 0) {
    throw new Error('No notes provided');
  }
  if (!isFinite(bpm) || isNaN(bpm) || bpm < 4 || bpm > 999) {
    throw new Error('BPM must be between 4 and 999');
  }
  if (!isFinite(totalDuration) || isNaN(totalDuration) || totalDuration <= 0) {
    throw new Error('Invalid total duration');
  }
  for (let i = 0; i < notes.length; i++) {
    if (!isFinite(notes[i].time) || isNaN(notes[i].time)) {
      throw new Error(`Invalid timestamp at note ${i}`);
    }
    if (notes[i].noteNumber < 0 || notes[i].noteNumber > 127) {
      throw new Error(`Invalid note number ${notes[i].noteNumber} at index ${i}`);
    }
  }

  // Pre-compute conversion factor (avoids per-note division)
  const ticksPerSecond = (bpm / 60) * TICKS_PER_BEAT;

  const trackData: number[] = [];

  // Tempo meta event: FF 51 03 tt tt tt (microseconds per beat)
  const microsecondsPerBeat = Math.round(60_000_000 / bpm);
  pushVLQ(trackData, 0); // delta time = 0
  trackData.push(
    0xff, 0x51, 0x03,
    (microsecondsPerBeat >> 16) & 0xff,
    (microsecondsPerBeat >> 8) & 0xff,
    microsecondsPerBeat & 0xff
  );

  // Embed full song data as a MIDI text meta event (FF 01)
  // The text bytes are deferred: we record their position in trackData and
  // batch-copy them via .set() into the final Uint8Array, avoiding per-byte push().
  let deferredTextBytes: Uint8Array | null = null;
  let deferredTextInsertPos = -1;
  if (songPayload) {
    deferredTextBytes = new TextEncoder().encode('SOLUCAST:' + JSON.stringify(songPayload));
    pushVLQ(trackData, 0);           // delta = 0
    trackData.push(0xff, 0x01);      // text meta event
    pushVLQ(trackData, deferredTextBytes.length);
    deferredTextInsertPos = trackData.length;
    // Extend array length to reserve space (filled with undefined, overwritten below)
    trackData.length += deferredTextBytes.length;
  }

  // Write CC 3 (item type indicator) at tick 0, before identity notes.
  // Omitted for song type (0) for backward compatibility.
  const channel = 0;
  let lastTick = 0;
  const hasItemTypeCC = itemTypeCC !== undefined && itemTypeCC > 0;

  if (hasItemTypeCC) {
    pushVLQ(trackData, 0); // delta = 0
    trackData.push(0xb0 | channel, ITEM_TYPE_CC, itemTypeCC & 0x7f);
  }

  // Write song ID header notes near time 0 with tick gaps between them.
  // NoteOns deferred slightly after CC 3 (if present) so DAWs don't reorder
  // CC 3 after the identity notes — simultaneous MIDI events at the same tick
  // have no guaranteed order. NoteOffs deferred to end of track so the identity
  // notes span the entire duration (visible as long bars in the DAW).

  if (songIdNotes && songIdNotes.length > 0) {
    // Note1 NoteOn — 4 ticks after CC 3 to guarantee CC arrives first (~4ms at 120 BPM)
    const ccGap = hasItemTypeCC ? 4 : 0;
    pushVLQ(trackData, ccGap);
    trackData.push(0x90 | channel, songIdNotes[0].noteNumber, songIdNotes[0].velocity);
    lastTick = ccGap;
    // Note2 NoteOn at delta 2 (2 ticks later — preserves ordering between the pair)
    if (songIdNotes.length > 1) {
      pushVLQ(trackData, 2);
      trackData.push(0x90 | channel, songIdNotes[1].noteNumber, songIdNotes[1].velocity);
      lastTick += 2;
    }
    // NoteOffs written after all slide notes
  }

  // Generate slide note events
  const velocity = 100;

  for (let i = 0; i < notes.length; i++) {
    const { noteNumber, time } = notes[i];

    const startTick = Math.round(time * ticksPerSecond);
    const endTime = i + 1 < notes.length
      ? notes[i + 1].time
      : totalDuration;
    const endTick = Math.round(endTime * ticksPerSecond);

    // Note On
    const noteOnDelta = Math.max(0, startTick - lastTick);
    pushVLQ(trackData, noteOnDelta);
    trackData.push(0x90 | channel, noteNumber, velocity);
    lastTick += noteOnDelta;

    // Note Off
    const noteOffDelta = Math.max(1, endTick - lastTick);
    pushVLQ(trackData, noteOffDelta);
    trackData.push(0x80 | channel, noteNumber, 0);
    lastTick += noteOffDelta;
  }

  // Close song ID notes at end of track (spanning the full song duration)
  if (songIdNotes && songIdNotes.length > 0) {
    const endTick = Math.round(totalDuration * ticksPerSecond);
    const delta = Math.max(0, endTick - lastTick);
    pushVLQ(trackData, delta);
    trackData.push(0x80 | channel, songIdNotes[0].noteNumber, 0);
    lastTick += delta;
    if (songIdNotes.length > 1) {
      pushVLQ(trackData, 0);
      trackData.push(0x80 | channel, songIdNotes[1].noteNumber, 0);
    }
  }

  // End of track meta event
  pushVLQ(trackData, 0);
  trackData.push(0xff, 0x2f, 0x00);

  // Build complete MIDI file directly into Uint8Array (avoids intermediate arrays + spread)
  // Header: 4 (MThd) + 4 (length) + 6 (data) = 14 bytes
  // Track header: 4 (MTrk) + 4 (length) = 8 bytes
  const totalSize = 14 + 8 + trackData.length;
  const result = new Uint8Array(totalSize);
  let offset = 0;

  // MThd header
  result[offset++] = 0x4d; // M
  result[offset++] = 0x54; // T
  result[offset++] = 0x68; // h
  result[offset++] = 0x64; // d
  // Header chunk length: 6
  result[offset++] = 0; result[offset++] = 0; result[offset++] = 0; result[offset++] = 6;
  // Format type: 0 (single track)
  result[offset++] = 0; result[offset++] = 0;
  // Number of tracks: 1
  result[offset++] = 0; result[offset++] = 1;
  // Ticks per beat
  result[offset++] = (TICKS_PER_BEAT >> 8) & 0xff;
  result[offset++] = TICKS_PER_BEAT & 0xff;

  // MTrk header
  result[offset++] = 0x4d; // M
  result[offset++] = 0x54; // T
  result[offset++] = 0x72; // r
  result[offset++] = 0x6b; // k
  // Track data length
  result[offset++] = (trackData.length >> 24) & 0xff;
  result[offset++] = (trackData.length >> 16) & 0xff;
  result[offset++] = (trackData.length >> 8) & 0xff;
  result[offset++] = trackData.length & 0xff;

  // Track data — single copy into final buffer
  result.set(trackData, offset);

  // Batch-copy deferred text bytes (overwrites the placeholder zeros)
  if (deferredTextBytes && deferredTextInsertPos >= 0) {
    result.set(deferredTextBytes, offset + deferredTextInsertPos);
  }

  return result;
}

/** Read a MIDI variable-length quantity from a byte array. Returns [value, bytesConsumed]. */
function readVLQ(data: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let bytesRead = 0;
  for (;;) {
    if (offset + bytesRead >= data.length) return [value, bytesRead];
    const byte = data[offset + bytesRead];
    bytesRead++;
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) break;
  }
  return [value, bytesRead];
}

/**
 * Parse a MIDI file's binary data and extract the embedded SoluCast payload.
 * Returns null if the file is not a valid MIDI or contains no SOLUCAST: text event.
 * The returned object is a MidiItemPayload (superset of MidiSongPayload).
 */
export function parseMidiSongPayload(data: Uint8Array): MidiItemPayload | null {
  // Validate MThd header
  if (data.length < 14) return null;
  if (data[0] !== 0x4d || data[1] !== 0x54 || data[2] !== 0x68 || data[3] !== 0x64) return null;

  // Skip MThd: 4 magic + 4 length + 6 header data = 14 bytes
  let pos = 14;

  // Find MTrk chunk
  while (pos + 8 <= data.length) {
    if (data[pos] === 0x4d && data[pos + 1] === 0x54 && data[pos + 2] === 0x72 && data[pos + 3] === 0x6b) {
      break;
    }
    // Skip unknown chunk: 4 magic + 4 length + chunk data
    const chunkLen = (data[pos + 4] << 24) | (data[pos + 5] << 16) | (data[pos + 6] << 8) | data[pos + 7];
    pos += 8 + chunkLen;
  }

  if (pos + 8 > data.length) return null;

  const trackLen = (data[pos + 4] << 24) | (data[pos + 5] << 16) | (data[pos + 6] << 8) | data[pos + 7];
  const trackStart = pos + 8;
  const trackEnd = trackStart + trackLen;

  let offset = trackStart;
  let runningStatus = 0;

  while (offset < trackEnd && offset < data.length) {
    // Read delta time
    const [, deltaBytes] = readVLQ(data, offset);
    offset += deltaBytes;
    if (offset >= data.length) break;

    const statusByte = data[offset];

    if (statusByte === 0xff) {
      // Meta event: FF type length data
      if (offset + 2 > data.length) break;
      const metaType = data[offset + 1];
      const [metaLen, metaLenBytes] = readVLQ(data, offset + 2);
      const metaDataStart = offset + 2 + metaLenBytes;

      if (metaType === 0x01 && metaDataStart + metaLen <= data.length) {
        // Text meta event — check for SOLUCAST: prefix
        const textBytes = data.subarray(metaDataStart, metaDataStart + metaLen);
        const text = new TextDecoder().decode(textBytes);
        if (text.startsWith('SOLUCAST:')) {
          try {
            return JSON.parse(text.slice(9));
          } catch {
            return null;
          }
        }
      }

      offset = metaDataStart + metaLen;
      if (metaType === 0x2f) break; // End of Track
    } else if (statusByte === 0xf0 || statusByte === 0xf7) {
      // SysEx event: F0/F7 length data
      const [sysexLen, sysexLenBytes] = readVLQ(data, offset + 1);
      offset += 1 + sysexLenBytes + sysexLen;
    } else if (statusByte >= 0x80) {
      // Channel message — update running status
      runningStatus = statusByte;
      offset++; // skip status byte
      // Determine data byte count
      const msgType = statusByte & 0xf0;
      if (msgType === 0xc0 || msgType === 0xd0) {
        offset += 1; // 1 data byte
      } else {
        offset += 2; // 2 data bytes
      }
    } else {
      // Running status (data byte without new status)
      const msgType = runningStatus & 0xf0;
      if (msgType === 0xc0 || msgType === 0xd0) {
        offset += 1; // 1 data byte (current byte + 0 more)
      } else {
        offset += 2; // 2 data bytes (current byte + 1 more)
      }
    }
  }

  return null;
}
