/**
 * MIDI File Generator
 *
 * Generates a standard MIDI Type 0 file from slide timestamps.
 * Each slide maps to a MIDI note (slide 0 = note 0/C-1, slide 1 = note 1/C#-1, etc.)
 * Note durations span from one slide's start to the next slide's start.
 */

const TICKS_PER_BEAT = 480;

/** Notes 0–59 are slide triggers, 96–127 are song identity encoding */
export const SLIDE_NOTE_MAX = 59;
export const SONG_ID_NOTE_MIN = 96;

/**
 * FNV-1a hash of a string, reduced to a 24-bit value space (0 – 16,516,095).
 * Used to encode song UUIDs into 2 MIDI notes in the C7+ range.
 */
export function songIdToMidiHash(songId: string): number {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < songId.length; i++) {
    hash ^= songId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Reduce to unsigned 32-bit then mod into 24-bit value space
  return (hash >>> 0) % 16_516_096;
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
 * Decode 2 MIDI note descriptors back into a 24-bit song hash.
 */
export function decodeSongHash(
  note1: { pitch: number; velocity: number },
  note2: { pitch: number; velocity: number }
): number {
  const highPart = (note1.pitch - 96) * 127 + (note1.velocity - 1);
  const lowPart = (note2.pitch - 96) * 127 + (note2.velocity - 1);
  return highPart * 4064 + lowPart;
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
 * @returns Uint8Array containing the complete .mid binary
 */
export function generateMidiFile(
  notes: MidiNoteEntry[],
  totalDuration: number,
  bpm: number,
  songIdNotes?: Array<{ noteNumber: number; velocity: number }>
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

  // Write song ID header notes at time 0 (overlapping short notes with their own velocities).
  // All NoteOns fire at delta 0 so the bridge receives them nearly simultaneously
  // regardless of BPM, then all NoteOffs at delta 10 ticks.
  const channel = 0;
  let lastTick = 0;

  if (songIdNotes && songIdNotes.length > 0) {
    // All NoteOns at delta 0
    for (const idNote of songIdNotes) {
      pushVLQ(trackData, 0);
      trackData.push(0x90 | channel, idNote.noteNumber, idNote.velocity);
    }
    // All NoteOffs after 10 ticks (first gets delta 10, rest get delta 0)
    for (let n = 0; n < songIdNotes.length; n++) {
      pushVLQ(trackData, n === 0 ? 10 : 0);
      trackData.push(0x80 | channel, songIdNotes[n].noteNumber, 0);
    }
    lastTick = 10;
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

  return result;
}
