import { describe, test, expect } from 'vitest';
import {
  SLIDE_NOTE_MAX,
  BLANK_NOTE,
  ACTIVATE_NOTE,
  PAUSE_NOTE,
  STOP_NOTE,
  LOOP_ON_NOTE,
  LOOP_OFF_NOTE,
  SONG_ID_NOTE_MIN,
  ITEM_TYPE_CC,
  ITEM_TYPE_MAP,
  ITEM_TYPE_REVERSE_MAP,
  getSongHashInput,
  getItemHashInput,
  songIdToMidiHash,
  encodeSongHash,
  decodeSongHash,
  generateMidiFile,
  parseMidiSongPayload,
  MidiNoteEntry,
  MidiSongPayload,
  MidiItemPayload,
} from './midiWriter';

describe('midiWriter constants', () => {
  test('note zones do not overlap', () => {
    expect(SLIDE_NOTE_MAX).toBe(59);
    expect(BLANK_NOTE).toBe(60);
    expect(SONG_ID_NOTE_MIN).toBe(96);
    // Blank note is above slide zone
    expect(BLANK_NOTE).toBeGreaterThan(SLIDE_NOTE_MAX);
    // Song ID zone starts well above blank
    expect(SONG_ID_NOTE_MIN).toBeGreaterThan(BLANK_NOTE);
  });
});

describe('getSongHashInput', () => {
  test('returns normalized title with first two words of lyrics', () => {
    const slides = [
      { originalText: 'Hello world how are you' },
      { originalText: 'Second slide text' },
    ];
    expect(getSongHashInput('My Song', slides)).toBe('my song|hello world');
  });

  test('handles empty slides array', () => {
    expect(getSongHashInput('Test Title', [])).toBe('test title|');
  });

  test('handles undefined slides', () => {
    expect(getSongHashInput('Test Title')).toBe('test title|');
  });

  test('skips blank slides to find first non-empty text', () => {
    const slides = [
      { originalText: '' },
      { originalText: '  ' },
      { originalText: 'First real lyrics here' },
    ];
    expect(getSongHashInput('Song', slides)).toBe('song|first real');
  });

  test('handles single-word lyrics', () => {
    const slides = [{ originalText: 'Hallelujah' }];
    expect(getSongHashInput('Praise', slides)).toBe('praise|hallelujah');
  });

  test('normalizes whitespace and casing', () => {
    const slides = [{ originalText: '  HELLO   WORLD  extra ' }];
    expect(getSongHashInput('  MY SONG  ', slides)).toBe('my song|hello world');
  });

  test('same song on different computers produces same hash input', () => {
    // Simulates two computers with different slide objects but same content
    const slidesComputer1 = [{ originalText: 'ברוך הבא לעולם', id: 'abc-123' }];
    const slidesComputer2 = [{ originalText: 'ברוך הבא לעולם', id: 'xyz-789' }];
    expect(getSongHashInput('שיר טוב', slidesComputer1))
      .toBe(getSongHashInput('שיר טוב', slidesComputer2));
  });
});

describe('songIdToMidiHash', () => {
  test('returns consistent hash for same input', () => {
    const h1 = songIdToMidiHash('abc-123');
    const h2 = songIdToMidiHash('abc-123');
    expect(h1).toBe(h2);
  });

  test('returns different hashes for different inputs', () => {
    const h1 = songIdToMidiHash('song-a');
    const h2 = songIdToMidiHash('song-b');
    expect(h1).not.toBe(h2);
  });

  test('hash is within valid range (0 to 16_516_095)', () => {
    const ids = ['uuid-1', 'uuid-2', 'test-song', '', 'a'.repeat(200)];
    for (const id of ids) {
      const hash = songIdToMidiHash(id);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(16_516_096);
    }
  });

  test('hash is canonical (min part first)', () => {
    // For any hash, decoding then re-encoding should give the same hash
    for (let i = 0; i < 20; i++) {
      const id = `test-song-${i}-${Math.random()}`;
      const hash = songIdToMidiHash(id);
      const { note1, note2 } = encodeSongHash(hash);
      // Decode in both orders — should give same result
      const decoded1 = decodeSongHash(note1, note2);
      const decoded2 = decodeSongHash(note2, note1);
      expect(decoded1).toBe(hash);
      expect(decoded2).toBe(hash);
    }
  });
});

describe('encodeSongHash / decodeSongHash', () => {
  test('round-trips correctly for canonical hashes', () => {
    // Only canonical hashes round-trip: floor(h/4064) <= h%4064
    // (songIdToMidiHash always produces canonical hashes)
    const testHashes = [0, 1, 4063, 4065, 100000, 16_516_095];
    for (const hash of testHashes) {
      const encoded = encodeSongHash(hash);
      const decoded = decodeSongHash(encoded.note1, encoded.note2);
      expect(decoded).toBe(hash);
    }
  });

  test('encoded notes are in valid MIDI range', () => {
    for (let i = 0; i < 50; i++) {
      const hash = Math.floor(Math.random() * 16_516_096);
      const { note1, note2 } = encodeSongHash(hash);
      expect(note1.pitch).toBeGreaterThanOrEqual(96);
      expect(note1.pitch).toBeLessThanOrEqual(127);
      expect(note1.velocity).toBeGreaterThanOrEqual(1);
      expect(note1.velocity).toBeLessThanOrEqual(127);
      expect(note2.pitch).toBeGreaterThanOrEqual(96);
      expect(note2.pitch).toBeLessThanOrEqual(127);
      expect(note2.velocity).toBeGreaterThanOrEqual(1);
      expect(note2.velocity).toBeLessThanOrEqual(127);
    }
  });

  test('decode is order-independent (DAW reorder safety)', () => {
    const hash = songIdToMidiHash('my-test-song-id');
    const { note1, note2 } = encodeSongHash(hash);
    expect(decodeSongHash(note1, note2)).toBe(decodeSongHash(note2, note1));
  });
});

describe('generateMidiFile', () => {
  test('generates valid MIDI header', () => {
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120);

    // MThd magic bytes
    expect(midi[0]).toBe(0x4d); // M
    expect(midi[1]).toBe(0x54); // T
    expect(midi[2]).toBe(0x68); // h
    expect(midi[3]).toBe(0x64); // d

    // Header length = 6
    expect(midi[4]).toBe(0);
    expect(midi[5]).toBe(0);
    expect(midi[6]).toBe(0);
    expect(midi[7]).toBe(6);

    // Format 0
    expect(midi[8]).toBe(0);
    expect(midi[9]).toBe(0);

    // 1 track
    expect(midi[10]).toBe(0);
    expect(midi[11]).toBe(1);
  });

  test('includes blank note (60) in output', () => {
    const notes: MidiNoteEntry[] = [
      { noteNumber: BLANK_NOTE, time: 0 },
      { noteNumber: 0, time: 2 },
      { noteNumber: 1, time: 5 },
    ];
    const midi = generateMidiFile(notes, 10, 120);

    // Search for Note On with note 60 (0x90 0x3C ...)
    let foundBlankNoteOn = false;
    for (let i = 0; i < midi.length - 2; i++) {
      if (midi[i] === 0x90 && midi[i + 1] === BLANK_NOTE && midi[i + 2] > 0) {
        foundBlankNoteOn = true;
        break;
      }
    }
    expect(foundBlankNoteOn).toBe(true);

    // Search for Note Off with note 60 (0x80 0x3C 0x00)
    let foundBlankNoteOff = false;
    for (let i = 0; i < midi.length - 2; i++) {
      if (midi[i] === 0x80 && midi[i + 1] === BLANK_NOTE && midi[i + 2] === 0) {
        foundBlankNoteOff = true;
        break;
      }
    }
    expect(foundBlankNoteOff).toBe(true);
  });

  test('includes song ID header notes before slide notes', () => {
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 1 }];
    const songIdNotes = [
      { noteNumber: 100, velocity: 50 },
      { noteNumber: 110, velocity: 75 },
    ];
    const midi = generateMidiFile(notes, 10, 120, songIdNotes);

    // Find positions of song ID NoteOn and slide NoteOn
    let songIdPos = -1;
    let slidePos = -1;
    for (let i = 0; i < midi.length - 2; i++) {
      if (midi[i] === 0x90 && midi[i + 1] === 100 && midi[i + 2] === 50) {
        songIdPos = i;
      }
      if (midi[i] === 0x90 && midi[i + 1] === 0 && midi[i + 2] === 100) {
        slidePos = i;
      }
    }
    // Song ID should appear before slide notes
    expect(songIdPos).toBeGreaterThan(-1);
    expect(slidePos).toBeGreaterThan(-1);
    expect(songIdPos).toBeLessThan(slidePos);
  });

  test('song ID NoteOffs appear after all slide NoteOffs (full duration)', () => {
    const notes: MidiNoteEntry[] = [
      { noteNumber: 0, time: 0 },
      { noteNumber: 1, time: 5 },
    ];
    const songIdNotes = [
      { noteNumber: 100, velocity: 50 },
      { noteNumber: 110, velocity: 75 },
    ];
    const midi = generateMidiFile(notes, 10, 120, songIdNotes);

    // Find last slide NoteOff and first song ID NoteOff positions
    let lastSlideNoteOff = -1;
    let firstSongIdNoteOff = -1;
    for (let i = 0; i < midi.length - 2; i++) {
      if (midi[i] === 0x80 && (midi[i + 1] === 0 || midi[i + 1] === 1) && midi[i + 2] === 0) {
        lastSlideNoteOff = i;
      }
      if (midi[i] === 0x80 && (midi[i + 1] === 100 || midi[i + 1] === 110) && midi[i + 2] === 0) {
        if (firstSongIdNoteOff === -1) firstSongIdNoteOff = i;
      }
    }
    // Song ID NoteOffs should come after all slide NoteOffs
    expect(lastSlideNoteOff).toBeGreaterThan(-1);
    expect(firstSongIdNoteOff).toBeGreaterThan(-1);
    expect(firstSongIdNoteOff).toBeGreaterThan(lastSlideNoteOff);
  });

  test('throws on empty notes', () => {
    expect(() => generateMidiFile([], 10, 120)).toThrow('No notes provided');
  });

  test('throws on invalid BPM', () => {
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    expect(() => generateMidiFile(notes, 10, 0)).toThrow('BPM must be between 4 and 999');
    expect(() => generateMidiFile(notes, 10, 1000)).toThrow('BPM must be between 4 and 999');
    expect(() => generateMidiFile(notes, 10, NaN)).toThrow('BPM must be between 4 and 999');
  });

  test('throws on invalid duration', () => {
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    expect(() => generateMidiFile(notes, 0, 120)).toThrow('Invalid total duration');
    expect(() => generateMidiFile(notes, -1, 120)).toThrow('Invalid total duration');
  });

  test('end-to-end: blank + slides + song ID produces valid file', () => {
    const hashInput = getSongHashInput('Amazing Grace', [{ originalText: 'Amazing grace how sweet the sound' }]);
    const songHash = songIdToMidiHash(hashInput);
    const { note1, note2 } = encodeSongHash(songHash);
    const songIdNotes = [
      { noteNumber: note1.pitch, velocity: note1.velocity },
      { noteNumber: note2.pitch, velocity: note2.velocity },
    ];

    const notes: MidiNoteEntry[] = [
      { noteNumber: BLANK_NOTE, time: 0 },    // Blank at start
      { noteNumber: 0, time: 2.5 },           // Slide 0 (first verse)
      { noteNumber: 1, time: 5.0 },           // Slide 1
      { noteNumber: BLANK_NOTE, time: 7.5 },  // Mid-song blank
      { noteNumber: 2, time: 10.0 },          // Slide 2
    ];

    const midi = generateMidiFile(notes, 15, 120, songIdNotes);

    // Should be a valid Uint8Array with MThd header
    expect(midi).toBeInstanceOf(Uint8Array);
    expect(midi.length).toBeGreaterThan(22); // At minimum: 14 header + 8 track header
    expect(String.fromCharCode(midi[0], midi[1], midi[2], midi[3])).toBe('MThd');
    expect(String.fromCharCode(midi[14], midi[15], midi[16], midi[17])).toBe('MTrk');

    // Count Note On events for note 60 (blank) — should be 2
    let blankCount = 0;
    for (let i = 0; i < midi.length - 2; i++) {
      if (midi[i] === 0x90 && midi[i + 1] === BLANK_NOTE && midi[i + 2] === 100) {
        blankCount++;
      }
    }
    expect(blankCount).toBe(2);
  });
});

describe('parseMidiSongPayload', () => {
  const makePayload = (overrides?: Partial<MidiSongPayload>): MidiSongPayload => ({
    title: 'Test Song',
    slides: [
      { originalText: 'Line 1', transliteration: 'Transliteration 1', translation: 'Translation 1', verseType: '[Verse1]' },
      { originalText: 'Line 2', translation: 'Translation 2', verseType: '[Chorus]' },
    ],
    author: 'Test Author',
    ...overrides,
  });

  test('round-trip: embed then parse returns identical payload', () => {
    const payload = makePayload();
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120, undefined, payload);
    const parsed = parseMidiSongPayload(midi);

    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe(payload.title);
    expect(parsed!.slides).toEqual(payload.slides);
    expect(parsed!.author).toBe(payload.author);
  });

  test('no payload: parse returns null when no song data embedded', () => {
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120);
    expect(parseMidiSongPayload(midi)).toBeNull();
  });

  test('Hebrew/Unicode text survives round-trip', () => {
    const payload = makePayload({
      title: 'שיר עברי',
      slides: [
        { originalText: 'ברוך הבא בשם ה׳', transliteration: 'Baruch haba beshem Adonai', translation: 'Blessed is he who comes' },
        { originalText: 'הללו את ה׳', verseType: '[Chorus]' },
      ],
    });
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120, undefined, payload);
    const parsed = parseMidiSongPayload(midi);

    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe('שיר עברי');
    expect(parsed!.slides[0].originalText).toBe('ברוך הבא בשם ה׳');
    expect(parsed!.slides[1].originalText).toBe('הללו את ה׳');
  });

  test('coexists with song ID notes', () => {
    const payload = makePayload();
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }, { noteNumber: 1, time: 3 }];
    const songIdNotes = [
      { noteNumber: 100, velocity: 50 },
      { noteNumber: 110, velocity: 75 },
    ];
    const midi = generateMidiFile(notes, 10, 120, songIdNotes, payload);
    const parsed = parseMidiSongPayload(midi);

    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe(payload.title);
    expect(parsed!.slides).toEqual(payload.slides);
  });

  test('corrupt/non-MIDI data returns null', () => {
    expect(parseMidiSongPayload(new Uint8Array([]))).toBeNull();
    expect(parseMidiSongPayload(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
    expect(parseMidiSongPayload(new Uint8Array(100))).toBeNull();
  });

  test('large payload with VLQ > 127 bytes works', () => {
    // Create a payload large enough that the text event length requires multi-byte VLQ
    const longSlides = Array.from({ length: 20 }, (_, i) => ({
      originalText: `Slide ${i} with some longer text to make the payload bigger ${'lorem ipsum '.repeat(5)}`,
      transliteration: `Transliteration for slide ${i} ${'dolor sit amet '.repeat(3)}`,
      translation: `Translation for slide ${i} ${'consectetur '.repeat(4)}`,
      verseType: i % 3 === 0 ? '[Verse1]' : i % 3 === 1 ? '[Chorus]' : '[Bridge]',
    }));
    const payload = makePayload({ slides: longSlides, tags: ['tag1', 'tag2', 'worship'] });

    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120, undefined, payload);
    const parsed = parseMidiSongPayload(midi);

    expect(parsed).not.toBeNull();
    expect(parsed!.slides.length).toBe(20);
    expect(parsed!.slides[0].originalText).toContain('Slide 0');
    expect(parsed!.tags).toEqual(['tag1', 'tag2', 'worship']);
  });

  test('all optional fields survive round-trip', () => {
    const payload: MidiSongPayload = {
      title: 'Full Song',
      slides: [{
        originalText: 'Text',
        transliteration: 'Trans',
        translation: 'Transl',
        translationOverflow: 'Overflow text',
        verseType: '[Verse1]',
      }],
      author: 'Author Name',
      originalLanguage: 'Hebrew',
      tags: ['worship', 'praise'],
    };
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120, undefined, payload);
    const parsed = parseMidiSongPayload(midi);

    expect(parsed).toEqual(payload);
  });
});

// ============================================================
// New protocol extensions
// ============================================================

describe('new note constants', () => {
  test('action notes are in the expected range', () => {
    expect(ACTIVATE_NOTE).toBe(61);
    expect(PAUSE_NOTE).toBe(62);
    expect(STOP_NOTE).toBe(63);
    expect(LOOP_ON_NOTE).toBe(64);
    expect(LOOP_OFF_NOTE).toBe(65);
  });

  test('action notes are between blank and song ID zones', () => {
    expect(ACTIVATE_NOTE).toBeGreaterThan(BLANK_NOTE);
    expect(LOOP_OFF_NOTE).toBeLessThan(SONG_ID_NOTE_MIN);
  });

  test('ITEM_TYPE_CC is 3', () => {
    expect(ITEM_TYPE_CC).toBe(3);
  });
});

describe('ITEM_TYPE_MAP / ITEM_TYPE_REVERSE_MAP', () => {
  test('song is 0 (backward compat default)', () => {
    expect(ITEM_TYPE_MAP['song']).toBe(0);
  });

  test('all types have unique values', () => {
    const values = Object.values(ITEM_TYPE_MAP);
    expect(new Set(values).size).toBe(values.length);
  });

  test('reverse map is consistent', () => {
    for (const [type, value] of Object.entries(ITEM_TYPE_MAP)) {
      expect(ITEM_TYPE_REVERSE_MAP[value]).toBe(type);
    }
  });
});

describe('getItemHashInput', () => {
  test('song type delegates to getSongHashInput', () => {
    const item = { title: 'My Song', slides: [{ originalText: 'Hello world' }] };
    expect(getItemHashInput('song', item)).toBe(getSongHashInput('My Song', item.slides));
  });

  test('bible type delegates to getSongHashInput', () => {
    const item = { title: 'Genesis 1', slides: [{ originalText: 'In the beginning' }] };
    expect(getItemHashInput('bible', item)).toBe(getSongHashInput('Genesis 1', item.slides));
  });

  test('presentation type uses title', () => {
    expect(getItemHashInput('presentation', { title: '  My Pres  ' })).toBe('pres|my pres');
  });

  test('media type uses mediaName', () => {
    expect(getItemHashInput('media', { mediaName: 'Sunset.jpg' })).toBe('media|sunset.jpg');
  });

  test('countdown type uses time and message', () => {
    expect(getItemHashInput('countdown', { countdownTime: 300, countdownMessage: 'Service Starts' }))
      .toBe('countdown|300|service starts');
  });

  test('youtube type uses videoId', () => {
    expect(getItemHashInput('youtube', { youtubeVideoId: 'dQw4w9WgXcQ' })).toBe('yt|dQw4w9WgXcQ');
  });

  test('stopwatch and clock are fixed', () => {
    expect(getItemHashInput('stopwatch', {})).toBe('stopwatch');
    expect(getItemHashInput('clock', {})).toBe('clock');
  });

  test('announcement uses first 30 chars', () => {
    const longText = 'A very long announcement that exceeds thirty characters limit';
    expect(getItemHashInput('announcement', { announcementText: longText }))
      .toBe(`announce|${longText.slice(0, 30).trim().toLowerCase()}`);
  });

  test('messages uses first 2 entries', () => {
    expect(getItemHashInput('messages', { messages: ['First', 'Second', 'Third'] }))
      .toBe('messages|first|second');
  });

  test('same item produces same hash', () => {
    const item = { title: 'Test Pres' };
    expect(getItemHashInput('presentation', item)).toBe(getItemHashInput('presentation', item));
  });
});

describe('generateMidiFile with itemTypeCC', () => {
  test('CC 3 event is written when itemTypeCC > 0', () => {
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120, undefined, undefined, 1); // presentation

    // Search for CC event: 0xB0 0x03 0x01
    let foundCC = false;
    for (let i = 0; i < midi.length - 2; i++) {
      if (midi[i] === 0xb0 && midi[i + 1] === ITEM_TYPE_CC && midi[i + 2] === 1) {
        foundCC = true;
        break;
      }
    }
    expect(foundCC).toBe(true);
  });

  test('CC 3 event is NOT written when itemTypeCC is 0 (song)', () => {
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120, undefined, undefined, 0);

    // Should NOT contain CC 3
    let foundCC = false;
    for (let i = 0; i < midi.length - 2; i++) {
      if (midi[i] === 0xb0 && midi[i + 1] === ITEM_TYPE_CC) {
        foundCC = true;
        break;
      }
    }
    expect(foundCC).toBe(false);
  });

  test('CC 3 event is NOT written when itemTypeCC is undefined', () => {
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120);

    let foundCC = false;
    for (let i = 0; i < midi.length - 2; i++) {
      if (midi[i] === 0xb0 && midi[i + 1] === ITEM_TYPE_CC) {
        foundCC = true;
        break;
      }
    }
    expect(foundCC).toBe(false);
  });

  test('CC 3 appears before identity notes', () => {
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 1 }];
    const songIdNotes = [
      { noteNumber: 100, velocity: 50 },
      { noteNumber: 110, velocity: 75 },
    ];
    const midi = generateMidiFile(notes, 10, 120, songIdNotes, undefined, 1);

    let ccPos = -1;
    let idNotePos = -1;
    for (let i = 0; i < midi.length - 2; i++) {
      if (midi[i] === 0xb0 && midi[i + 1] === ITEM_TYPE_CC && ccPos === -1) {
        ccPos = i;
      }
      if (midi[i] === 0x90 && midi[i + 1] === 100 && midi[i + 2] === 50 && idNotePos === -1) {
        idNotePos = i;
      }
    }
    expect(ccPos).toBeGreaterThan(-1);
    expect(idNotePos).toBeGreaterThan(-1);
    expect(ccPos).toBeLessThan(idNotePos);
  });
});

describe('action notes in generateMidiFile', () => {
  test('action notes 61-63 are valid and produce correct NoteOn/Off', () => {
    const notes: MidiNoteEntry[] = [
      { noteNumber: ACTIVATE_NOTE, time: 0 },
      { noteNumber: PAUSE_NOTE, time: 3 },
      { noteNumber: STOP_NOTE, time: 6 },
    ];
    const midi = generateMidiFile(notes, 10, 120);

    for (const note of [ACTIVATE_NOTE, PAUSE_NOTE, STOP_NOTE]) {
      let foundOn = false;
      let foundOff = false;
      for (let i = 0; i < midi.length - 2; i++) {
        if (midi[i] === 0x90 && midi[i + 1] === note && midi[i + 2] > 0) foundOn = true;
        if (midi[i] === 0x80 && midi[i + 1] === note) foundOff = true;
      }
      expect(foundOn).toBe(true);
      expect(foundOff).toBe(true);
    }
  });

  test('loop notes 64-65 produce correct NoteOn/Off', () => {
    const notes: MidiNoteEntry[] = [
      { noteNumber: LOOP_ON_NOTE, time: 0 },
      { noteNumber: LOOP_OFF_NOTE, time: 5 },
    ];
    const midi = generateMidiFile(notes, 10, 120);

    for (const note of [LOOP_ON_NOTE, LOOP_OFF_NOTE]) {
      let foundOn = false;
      for (let i = 0; i < midi.length - 2; i++) {
        if (midi[i] === 0x90 && midi[i + 1] === note && midi[i + 2] > 0) foundOn = true;
      }
      expect(foundOn).toBe(true);
    }
  });
});

describe('MidiItemPayload round-trip', () => {
  test('presentation payload round-trips', () => {
    const payload: MidiItemPayload = {
      title: 'My Presentation',
      slides: [],
      itemType: 'presentation',
      presentationSlides: [{ textBoxes: [{ text: 'Slide 1' }] }],
    };
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120, undefined, payload);
    const parsed = parseMidiSongPayload(midi);

    expect(parsed).not.toBeNull();
    expect(parsed!.itemType).toBe('presentation');
    expect(parsed!.presentationSlides).toEqual(payload.presentationSlides);
  });

  test('media payload with background round-trips', () => {
    const payload: MidiItemPayload = {
      title: 'Sunset Video',
      slides: [],
      itemType: 'media',
      mediaType: 'video',
      mediaPath: 'C:\\Users\\test\\sunset.mp4',
      mediaName: 'sunset.mp4',
      background: 'C:\\Users\\test\\bg.jpg',
    };
    const notes: MidiNoteEntry[] = [{ noteNumber: ACTIVATE_NOTE, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120, undefined, payload);
    const parsed = parseMidiSongPayload(midi);

    expect(parsed).not.toBeNull();
    expect(parsed!.itemType).toBe('media');
    expect(parsed!.mediaPath).toBe(payload.mediaPath);
    expect(parsed!.background).toBe(payload.background);
  });

  test('backward compat: old payload without itemType parses correctly', () => {
    const payload: MidiSongPayload = {
      title: 'Old Song',
      slides: [{ originalText: 'Lyrics' }],
      author: 'Author',
    };
    const notes: MidiNoteEntry[] = [{ noteNumber: 0, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120, undefined, payload);
    const parsed = parseMidiSongPayload(midi);

    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe('Old Song');
    expect(parsed!.itemType).toBeUndefined();
  });

  test('countdown payload round-trips', () => {
    const payload: MidiItemPayload = {
      title: 'Service Countdown',
      slides: [],
      itemType: 'countdown',
      countdownTime: 600,
      countdownMessage: 'Service starts in...',
    };
    const notes: MidiNoteEntry[] = [{ noteNumber: ACTIVATE_NOTE, time: 0 }];
    const midi = generateMidiFile(notes, 10, 120, undefined, payload);
    const parsed = parseMidiSongPayload(midi);

    expect(parsed).not.toBeNull();
    expect(parsed!.itemType).toBe('countdown');
    expect(parsed!.countdownTime).toBe(600);
    expect(parsed!.countdownMessage).toBe('Service starts in...');
  });
});
