import React, { useState, useEffect, useRef, useCallback } from 'react';
import socketService from '../services/socket';

const MAX_LOG_ENTRIES = 50;

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#09090b',
    color: '#e4e4e7',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
    padding: '24px',
    maxWidth: '900px',
    margin: '0 auto',
  },
  header: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '4px',
    color: '#f4f4f5',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#71717a',
    marginBottom: '24px',
  },
  section: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#a1a1aa',
    marginBottom: '12px',
  },
  row: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  input: {
    backgroundColor: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#f4f4f5',
    fontSize: '0.9rem',
    outline: 'none',
    width: '160px',
  },
  select: {
    backgroundColor: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#f4f4f5',
    fontSize: '0.9rem',
    outline: 'none',
    minWidth: '200px',
  },
  button: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  buttonDisabled: {
    backgroundColor: '#3f3f46',
    color: '#71717a',
    cursor: 'not-allowed',
  },
  buttonDanger: {
    backgroundColor: '#dc2626',
  },
  statusDot: (connected) => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: connected ? '#22c55e' : '#ef4444',
    marginRight: '6px',
  }),
  statusText: {
    fontSize: '0.85rem',
    color: '#a1a1aa',
  },
  setlistItem: (index) => ({
    padding: '6px 10px',
    backgroundColor: index % 2 === 0 ? '#1f1f23' : 'transparent',
    borderRadius: '4px',
    fontSize: '0.85rem',
    display: 'flex',
    gap: '8px',
  }),
  setlistIndex: {
    color: '#3b82f6',
    fontWeight: 600,
    minWidth: '28px',
  },
  setlistTitle: {
    color: '#d4d4d8',
  },
  logContainer: {
    maxHeight: '200px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    lineHeight: '1.5',
  },
  logEntry: {
    padding: '2px 0',
    color: '#a1a1aa',
    borderBottom: '1px solid #1f1f23',
  },
  commandBadge: {
    display: 'inline-block',
    backgroundColor: '#22c55e20',
    color: '#22c55e',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  mappingTable: {
    width: '100%',
    fontSize: '0.8rem',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '6px 8px',
    borderBottom: '1px solid #3f3f46',
    color: '#a1a1aa',
    fontWeight: 500,
  },
  td: {
    padding: '6px 8px',
    borderBottom: '1px solid #1f1f23',
    color: '#d4d4d8',
  },
  warning: {
    backgroundColor: '#422006',
    border: '1px solid #92400e',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '16px',
    fontSize: '0.85rem',
    color: '#fbbf24',
  },
  channelInput: {
    width: '60px',
    textAlign: 'center',
  },
};

function MidiBridgePage() {
  const [pin, setPin] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [roomPin, setRoomPin] = useState(null);
  const [midiAccess, setMidiAccess] = useState(null);
  const [midiInputs, setMidiInputs] = useState([]);
  const [selectedInput, setSelectedInput] = useState('');
  const [midiLog, setMidiLog] = useState([]);
  const [setlist, setSetlist] = useState([]);
  const [lastCommand, setLastCommand] = useState(null);
  const [midiChannel, setMidiChannel] = useState(16);
  const [midiSupported, setMidiSupported] = useState(true);
  const [error, setError] = useState(null);

  const activeInputRef = useRef(null);
  const logContainerRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const connectOnceRef = useRef(null); // Stores socket.once('connect') callback for cleanup
  // Use refs for values accessed in MIDI callback to avoid stale closures
  const setlistRef = useRef(setlist);
  const midiChannelRef = useRef(midiChannel);
  const roomPinRef = useRef(roomPin);
  // Song identity note buffering: stores first note of a 2-note pair
  const songIdBufferRef = useRef(null); // { pitch, velocity, time }
  const songIdTimerRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { setlistRef.current = setlist; }, [setlist]);
  useEffect(() => { midiChannelRef.current = midiChannel; }, [midiChannel]);
  useEffect(() => { roomPinRef.current = roomPin; }, [roomPin]);

  const connected = !!roomPin;

  // Check Web MIDI support
  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setMidiSupported(false);
    }
  }, []);

  // Helper to clean up pending connection artifacts
  const cleanupPendingConnect = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    if (connectOnceRef.current) {
      const socket = socketService.connect();
      if (socket) socket.off('connect', connectOnceRef.current);
      connectOnceRef.current = null;
    }
  }, []);

  // Connect socket on mount, listen for connection loss
  useEffect(() => {
    socketService.connect();

    const unsubDisconnect = socketService.on('disconnect', () => {
      cleanupPendingConnect();
      setRoomPin(null);
      setConnecting(false);
    });

    return () => {
      unsubDisconnect();
      cleanupPendingConnect();
    };
  }, [cleanupPendingConnect]);

  // Listen for server events (always active so we catch midi:joined/midi:error)
  useEffect(() => {
    const unsubJoined = socketService.on('midi:joined', (data) => {
      cleanupPendingConnect();
      setRoomPin(data.roomPin);
      setConnecting(false);
      setError(null);
    });

    const unsubError = socketService.on('midi:error', (data) => {
      cleanupPendingConnect();
      setError(data.message);
      setConnecting(false);
      setRoomPin(null);
    });

    const unsubSetlist = socketService.on('setlist:summary', (data) => {
      if (data?.setlist) {
        setSetlist(data.setlist);
      }
    });

    return () => {
      unsubJoined();
      unsubError();
      unsubSetlist();
    };
  }, [cleanupPendingConnect]);

  // Request MIDI access
  const requestMidi = useCallback(async () => {
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      setMidiAccess(access);

      const updateInputs = () => {
        const inputs = [];
        access.inputs.forEach((input) => {
          inputs.push({ id: input.id, name: input.name || input.id });
        });
        setMidiInputs(inputs);
      };

      updateInputs();
      access.onstatechange = updateInputs;
    } catch (err) {
      setError('MIDI access denied. Check browser permissions.');
    }
  }, []);

  // Auto-request MIDI on mount if supported
  useEffect(() => {
    if (midiSupported) {
      requestMidi();
    }
  }, [midiSupported, requestMidi]);

  // Send command helper (stable ref — no deps that change)
  const sendCommand = useCallback((command) => {
    socketService.emit('midi:command', { command });
    setLastCommand(command);
  }, []);

  // Decode 2 MIDI notes (pitch 96–127, velocity 1–127) back into a 24-bit song hash
  const decodeSongHash = useCallback((note1, note2) => {
    const highPart = (note1.pitch - 96) * 127 + (note1.velocity - 1);
    const lowPart = (note2.pitch - 96) * 127 + (note2.velocity - 1);
    return highPart * 4064 + lowPart;
  }, []);

  // Handle a song identity note (pitch >= 96). Buffers first note; on second, decodes and sends command.
  const handleSongIdNote = useCallback((pitch, velocity) => {
    const now = Date.now();

    if (songIdBufferRef.current && (now - songIdBufferRef.current.time) < 200) {
      // Second note arrived within window — decode the pair
      if (songIdTimerRef.current) {
        clearTimeout(songIdTimerRef.current);
        songIdTimerRef.current = null;
      }
      const songHash = decodeSongHash(
        songIdBufferRef.current,
        { pitch, velocity }
      );
      songIdBufferRef.current = null;

      const currentRoomPin = roomPinRef.current;
      if (currentRoomPin) {
        sendCommand({ type: 'song:identify', payload: { songHash } });
      }
    } else {
      // First note — buffer it and set a timeout to clear if second never arrives
      songIdBufferRef.current = { pitch, velocity, time: now };
      if (songIdTimerRef.current) clearTimeout(songIdTimerRef.current);
      songIdTimerRef.current = setTimeout(() => {
        songIdBufferRef.current = null;
        songIdTimerRef.current = null;
      }, 200);
    }
  }, [decodeSongHash, sendCommand]);

  // MIDI message handler — reads from refs to avoid stale closures and re-binds
  const handleMidiMessage = useCallback((event) => {
    const status = event.data[0];
    const data1 = event.data[1];
    const data2 = event.data[2]; // undefined for 2-byte messages (e.g. Program Change)
    const messageType = status & 0xf0;
    const channel = (status & 0x0f) + 1; // MIDI channels are 1-16

    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');

    let typeLabel = '';
    let detail = '';

    switch (messageType) {
      case 0xc0: // Program Change
        typeLabel = 'Program Change';
        detail = `program=${data1}`;
        break;
      case 0x90: // Note On
        typeLabel = data2 > 0 ? 'Note On' : 'Note Off';
        detail = `note=${data1} vel=${data2}`;
        break;
      case 0x80: // Note Off
        typeLabel = 'Note Off';
        detail = `note=${data1} vel=${data2}`;
        break;
      case 0xb0: // CC
        typeLabel = 'CC';
        detail = `cc=${data1} val=${data2}`;
        break;
      default:
        typeLabel = `0x${messageType.toString(16)}`;
        detail = `d1=${data1} d2=${data2 ?? '-'}`;
    }

    const logEntry = `${timestamp}  ch${String(channel).padStart(2)}  ${typeLabel.padEnd(16)} ${detail}`;

    setMidiLog((prev) => {
      const next = [...prev, logEntry];
      return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
    });

    // Read current values from refs (avoids stale closures)
    const currentSetlist = setlistRef.current;
    const currentChannel = midiChannelRef.current;
    const currentRoomPin = roomPinRef.current;

    // Command mapping
    let command = null;

    // Program Change — ignored (song selection is handled by song identity notes 96–127)

    // Note On on configured channel — split by note range
    else if (messageType === 0x90 && data2 > 0 && channel === currentChannel) {
      if (data1 >= 96) {
        // Song identity zone (C7+): buffer/decode 2-note pair
        handleSongIdNote(data1, data2);
      } else if (data1 <= 59) {
        // Slide zone (C0–B4): go to slide by index
        command = { type: 'slide:goto', payload: { index: data1 } };
      }
      // Notes 60–95: dead zone, ignored
    }
    // CC 1 on configured channel → next slide
    else if (messageType === 0xb0 && data1 === 1 && data2 > 0 && channel === currentChannel) {
      command = { type: 'slide:next' };
    }
    // CC 2 on configured channel → prev slide
    else if (messageType === 0xb0 && data1 === 2 && data2 > 0 && channel === currentChannel) {
      command = { type: 'slide:prev' };
    }

    if (command && currentRoomPin) {
      sendCommand(command);
    }
  }, [sendCommand, handleSongIdNote]);

  // Bind/unbind MIDI input listener
  useEffect(() => {
    if (!midiAccess || !selectedInput) return;

    // Unbind previous
    if (activeInputRef.current) {
      activeInputRef.current.onmidimessage = null;
    }

    const input = midiAccess.inputs.get(selectedInput);
    if (input) {
      input.onmidimessage = handleMidiMessage;
      activeInputRef.current = input;
    }

    return () => {
      if (activeInputRef.current) {
        activeInputRef.current.onmidimessage = null;
        activeInputRef.current = null;
      }
    };
  }, [midiAccess, selectedInput, handleMidiMessage]);

  // Auto-scroll log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [midiLog]);

  const handleConnect = () => {
    if (!pin.trim()) return;
    setError(null);
    setConnecting(true);

    // Clear any previous pending .once('connect') and timeout
    const socket = socketService.connect();
    if (connectOnceRef.current && socket) {
      socket.off('connect', connectOnceRef.current);
      connectOnceRef.current = null;
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
    }

    // Ensure socket is connected before emitting
    if (socket && socket.connected) {
      socketService.emit('midi:join', { pin: pin.trim().toUpperCase() });
    } else if (socket) {
      // Wait for connection before emitting
      const onConnect = () => {
        connectOnceRef.current = null;
        socketService.emit('midi:join', { pin: pin.trim().toUpperCase() });
      };
      connectOnceRef.current = onConnect;
      socket.once('connect', onConnect);
    }

    // Timeout: if server doesn't respond within 10s, reset
    connectTimeoutRef.current = setTimeout(() => {
      connectTimeoutRef.current = null;
      // Clean up orphaned .once('connect') if it hasn't fired
      if (connectOnceRef.current && socket) {
        socket.off('connect', connectOnceRef.current);
        connectOnceRef.current = null;
      }
      setConnecting(false);
      setError('Connection timed out. Check the room PIN and try again.');
    }, 10000);
  };

  const handleDisconnect = () => {
    cleanupPendingConnect();
    // Notify server so it can clean up midiBridgeSockets
    socketService.emit('midi:leave', {});
    setRoomPin(null);
    setSetlist([]);
    setLastCommand(null);
    setMidiLog([]);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>MIDI Bridge</div>
      <div style={styles.subtitle}>Connect your DAW to SoluPresenter via MIDI</div>

      {!midiSupported && (
        <div style={styles.warning}>
          Web MIDI API is not supported in this browser. Use Chrome or Edge on desktop. HTTPS or localhost is required.
        </div>
      )}

      {error && (
        <div style={{ ...styles.warning, backgroundColor: '#450a0a', borderColor: '#7f1d1d', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Connection Panel */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Connection</div>
        <div style={styles.row}>
          {!connected ? (
            <>
              <input
                style={styles.input}
                type="text"
                placeholder="Room PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                maxLength={10}
                disabled={connecting}
              />
              <button
                style={{ ...styles.button, ...((!pin.trim() || connecting) ? styles.buttonDisabled : {}) }}
                onClick={handleConnect}
                disabled={!pin.trim() || connecting}
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </>
          ) : (
            <>
              <span style={styles.statusDot(true)} />
              <span style={styles.statusText}>Connected to room <strong>{roomPin}</strong></span>
              <button
                style={{ ...styles.button, ...styles.buttonDanger, marginLeft: 'auto' }}
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* MIDI Device Selector */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>MIDI Input</div>
        <div style={styles.row}>
          <select
            style={styles.select}
            value={selectedInput}
            onChange={(e) => setSelectedInput(e.target.value)}
            disabled={!midiSupported}
          >
            <option value="">-- Select MIDI Input --</option>
            {midiInputs.map((inp) => (
              <option key={inp.id} value={inp.id}>{inp.name}</option>
            ))}
          </select>
          <span style={{ ...styles.statusText, fontSize: '0.8rem' }}>Channel:</span>
          <input
            style={{ ...styles.input, ...styles.channelInput }}
            type="number"
            min={1}
            max={16}
            value={midiChannel}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val >= 1 && val <= 16) setMidiChannel(val);
            }}
          />
          {midiInputs.length === 0 && midiSupported && (
            <span style={{ ...styles.statusText, fontSize: '0.8rem' }}>No MIDI devices detected</span>
          )}
        </div>
      </div>

      {/* Setlist */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          Setlist {setlist.length > 0 && `(${setlist.length} items)`}
        </div>
        {setlist.length === 0 ? (
          <div style={{ ...styles.statusText, fontSize: '0.85rem' }}>
            {connected
              ? 'Waiting for setlist from operator...'
              : 'Connect to a room to see the setlist'}
          </div>
        ) : (
          <div>
            {setlist.map((item, i) => (
              <div key={item.id} style={styles.setlistItem(i)}>
                <span style={styles.setlistIndex}>PC {i}</span>
                <span style={styles.setlistTitle}>{item.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MIDI Mapping Reference */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>MIDI Mapping</div>
        <table style={styles.mappingTable}>
          <thead>
            <tr>
              <th style={styles.th}>MIDI Message</th>
              <th style={styles.th}>Action</th>
              <th style={styles.th}>Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Note 0–59 (ch {midiChannel})</td>
              <td style={styles.td}>Go to slide by index</td>
              <td style={styles.td}>Note 0 = slide 1</td>
            </tr>
            <tr>
              <td style={styles.td}>Note 96–127 (ch {midiChannel})</td>
              <td style={styles.td}>Song identity (2-note pair)</td>
              <td style={styles.td}>Auto-selects song by hash</td>
            </tr>
            <tr>
              <td style={styles.td}>Note 60–95 (ch {midiChannel})</td>
              <td style={styles.td}>Reserved (ignored)</td>
              <td style={styles.td}>Dead zone</td>
            </tr>
            <tr>
              <td style={styles.td}>CC 1 (ch {midiChannel}, val &gt; 0)</td>
              <td style={styles.td}>Next slide</td>
              <td style={styles.td}>Mod wheel tap</td>
            </tr>
            <tr>
              <td style={styles.td}>CC 2 (ch {midiChannel}, val &gt; 0)</td>
              <td style={styles.td}>Previous slide</td>
              <td style={styles.td}>CC 2 tap</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Last Command */}
      {lastCommand && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Last Command Sent</div>
          <span style={styles.commandBadge}>
            {lastCommand.type}
            {lastCommand.payload ? ` ${JSON.stringify(lastCommand.payload)}` : ''}
          </span>
        </div>
      )}

      {/* Activity Monitor */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          MIDI Activity {midiLog.length > 0 && `(${midiLog.length})`}
        </div>
        <div style={styles.logContainer} ref={logContainerRef}>
          {midiLog.length === 0 ? (
            <div style={{ ...styles.statusText, fontSize: '0.8rem' }}>
              {selectedInput ? 'Listening for MIDI messages...' : 'Select a MIDI input to start'}
            </div>
          ) : (
            midiLog.map((entry, i) => (
              <div key={i} style={styles.logEntry}>{entry}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default MidiBridgePage;
