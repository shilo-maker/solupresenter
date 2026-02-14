/**
 * Local MIDI Bridge UI
 * Self-contained HTML page served at /midi-bridge on the remoteControlServer.
 * Connects via Socket.IO to the same server, authenticates with PIN,
 * and translates Web MIDI messages into SoluPresenter commands.
 */
export function getMidiBridgeUI(port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SoluCast MIDI Bridge (Local)</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      min-height: 100vh;
      background-color: #09090b;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    }
    .page { padding: 24px; max-width: 900px; margin: 0 auto; }
    .header { font-size: 1.5rem; font-weight: 700; color: #f4f4f5; margin-bottom: 4px; }
    .subtitle { font-size: 0.85rem; color: #71717a; margin-bottom: 24px; }
    .section {
      background-color: #18181b; border: 1px solid #27272a;
      border-radius: 8px; padding: 16px; margin-bottom: 16px;
    }
    .section-title {
      font-size: 0.8rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: #a1a1aa; margin-bottom: 12px;
    }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    input, select {
      background-color: #27272a; border: 1px solid #3f3f46;
      border-radius: 6px; padding: 8px 12px; color: #f4f4f5;
      font-size: 0.9rem; outline: none;
    }
    input { width: 160px; }
    select { min-width: 200px; }
    .channel-input { width: 60px; text-align: center; }
    button {
      background-color: #3b82f6; color: #fff; border: none;
      border-radius: 6px; padding: 8px 16px; font-size: 0.9rem;
      cursor: pointer; font-weight: 500;
    }
    button:disabled { background-color: #3f3f46; color: #71717a; cursor: not-allowed; }
    .btn-danger { background-color: #dc2626; }
    .btn-danger:hover { background-color: #b91c1c; }
    .status-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px;
    }
    .status-dot.on { background-color: #22c55e; }
    .status-dot.off { background-color: #ef4444; }
    .status-text { font-size: 0.85rem; color: #a1a1aa; }
    .warning {
      background-color: #422006; border: 1px solid #92400e;
      border-radius: 6px; padding: 12px; margin-bottom: 16px;
      font-size: 0.85rem; color: #fbbf24;
    }
    .warning a { color: #fbbf24; }
    .error-box {
      background-color: #450a0a; border: 1px solid #7f1d1d;
      border-radius: 6px; padding: 12px; margin-bottom: 16px;
      font-size: 0.85rem; color: #fca5a5;
    }
    .setlist-item {
      padding: 6px 10px; border-radius: 4px; font-size: 0.85rem;
      display: flex; gap: 8px;
    }
    .setlist-item:nth-child(odd) { background-color: #1f1f23; }
    .setlist-idx { color: #3b82f6; font-weight: 600; min-width: 28px; }
    .setlist-title { color: #d4d4d8; }
    .command-badge {
      display: inline-block; background-color: #22c55e20; color: #22c55e;
      padding: 4px 10px; border-radius: 4px; font-size: 0.85rem; font-weight: 500;
    }
    .log-container {
      max-height: 200px; overflow-y: auto; font-family: monospace;
      font-size: 0.75rem; line-height: 1.5;
    }
    .log-entry { padding: 2px 0; color: #a1a1aa; border-bottom: 1px solid #1f1f23; }
    table { width: 100%; font-size: 0.8rem; border-collapse: collapse; }
    th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #3f3f46; color: #a1a1aa; font-weight: 500; }
    td { padding: 6px 8px; border-bottom: 1px solid #1f1f23; color: #d4d4d8; }
    .hidden { display: none !important; }
    .ml-auto { margin-left: auto; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">MIDI Bridge <span style="font-size:0.75rem;color:#71717a;font-weight:400">(Local)</span></div>
  <div class="subtitle">Connect your DAW to SoluPresenter over local network — no internet needed</div>

  <!-- HTTPS / Secure Context Warning -->
  <div id="secureWarning" class="warning hidden">
    <strong>Web MIDI requires a secure context.</strong><br>
    Your browser blocks MIDI access on plain HTTP. To fix this (one-time setup):<br>
    1. Open <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code><br>
    2. Add <code id="originUrl"></code> to the list<br>
    3. Restart Chrome<br><br>
    Alternatively, use <code>http://localhost:${port}/midi-bridge</code> if the DAW runs on the same machine.
  </div>

  <!-- No Web MIDI API at all -->
  <div id="noMidiWarning" class="warning hidden">
    Web MIDI API is not supported in this browser. Use Chrome or Edge on desktop.
  </div>

  <!-- Error display -->
  <div id="errorBox" class="error-box hidden"></div>

  <!-- Connection Panel -->
  <div class="section">
    <div class="section-title">Connection</div>
    <div class="row" id="connectRow">
      <input id="pinInput" type="text" placeholder="Enter PIN" maxlength="10" />
      <button id="connectBtn">Connect</button>
    </div>
    <div class="row hidden" id="connectedRow">
      <span class="status-dot on"></span>
      <span class="status-text">Connected (PIN: <strong id="connectedPin"></strong>)</span>
      <button class="btn-danger ml-auto" id="disconnectBtn">Disconnect</button>
    </div>
  </div>

  <!-- MIDI Device Selector -->
  <div class="section">
    <div class="section-title">MIDI Input</div>
    <div class="row">
      <select id="midiSelect" disabled>
        <option value="">-- Select MIDI Input --</option>
      </select>
      <span class="status-text" style="font-size:0.8rem">Channel:</span>
      <input id="channelInput" class="channel-input" type="number" min="1" max="16" value="16" />
      <span id="noDevicesHint" class="status-text" style="font-size:0.8rem"></span>
    </div>
  </div>

  <!-- Setlist -->
  <div class="section">
    <div class="section-title" id="setlistTitle">Setlist</div>
    <div id="setlistContent">
      <div class="status-text" style="font-size:0.85rem">Connect to see the setlist</div>
    </div>
  </div>

  <!-- MIDI Mapping Reference -->
  <div class="section">
    <div class="section-title">MIDI Mapping</div>
    <table>
      <thead><tr><th>MIDI Message</th><th>Action</th><th>Example</th></tr></thead>
      <tbody>
        <tr><td>Note 0–59 (ch <span class="ch-label">16</span>)</td><td>Go to slide by index</td><td>Note 0 = slide 1</td></tr>
        <tr><td>Note 60 (ch <span class="ch-label">16</span>)</td><td>Blank / clear screen</td><td>Clears display text</td></tr>
        <tr><td>Note 61 (ch <span class="ch-label">16</span>)</td><td>Activate (play/start/show)</td><td>Play video, start timer</td></tr>
        <tr><td>Note 62 (ch <span class="ch-label">16</span>)</td><td>Pause</td><td>Pause video/YouTube</td></tr>
        <tr><td>Note 63 (ch <span class="ch-label">16</span>)</td><td>Stop</td><td>Stop video/timer</td></tr>
        <tr><td>Note 64 (ch <span class="ch-label">16</span>)</td><td>Loop ON</td><td>Video loop / pres cycle</td></tr>
        <tr><td>Note 65 (ch <span class="ch-label">16</span>)</td><td>Loop OFF</td><td>Disable loop/cycle</td></tr>
        <tr><td>Note 66–95 (ch <span class="ch-label">16</span>)</td><td>Reserved (ignored)</td><td>Dead zone</td></tr>
        <tr><td>Note 96–127 (ch <span class="ch-label">16</span>)</td><td>Item identity (2-note pair)</td><td>Auto-selects item by hash</td></tr>
        <tr><td>CC 1 (ch <span class="ch-label">16</span>, val &gt; 0)</td><td>Next slide</td><td>Mod wheel tap</td></tr>
        <tr><td>CC 2 (ch <span class="ch-label">16</span>, val &gt; 0)</td><td>Previous slide</td><td>CC 2 tap</td></tr>
        <tr><td>CC 3 (ch <span class="ch-label">16</span>)</td><td>Item type indicator</td><td>0=song 1=pres 2=media ...</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Last Command -->
  <div class="section hidden" id="lastCommandSection">
    <div class="section-title">Last Command Sent</div>
    <span class="command-badge" id="lastCommandBadge"></span>
  </div>

  <!-- Activity Monitor -->
  <div class="section">
    <div class="section-title" id="activityTitle">MIDI Activity</div>
    <div class="log-container" id="logContainer">
      <div class="status-text" style="font-size:0.8rem" id="logPlaceholder">Select a MIDI input to start</div>
    </div>
  </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
(function() {
  'use strict';

  // ─── State ───
  var socket = null;
  var connected = false;
  var midiAccess = null;
  var activeInput = null;
  var midiChannel = 16;
  var setlist = [];
  var midiLog = [];
  var MAX_LOG = 50;

  // Song/item identity note buffering
  var songIdBuffer = null; // { pitch, velocity, time }
  var songIdTimer = null;

  // CC 3 item type context (sent before identity notes)
  var lastItemTypeCC = -1;
  var itemTypeCCTime = 0;

  // ─── DOM refs ───
  var $pinInput     = document.getElementById('pinInput');
  var $connectBtn   = document.getElementById('connectBtn');
  var $connectRow   = document.getElementById('connectRow');
  var $connectedRow = document.getElementById('connectedRow');
  var $connectedPin = document.getElementById('connectedPin');
  var $disconnectBtn= document.getElementById('disconnectBtn');
  var $midiSelect   = document.getElementById('midiSelect');
  var $channelInput = document.getElementById('channelInput');
  var $noDevicesHint= document.getElementById('noDevicesHint');
  var $setlistTitle = document.getElementById('setlistTitle');
  var $setlistContent= document.getElementById('setlistContent');
  var $lastCmdSection= document.getElementById('lastCommandSection');
  var $lastCmdBadge = document.getElementById('lastCommandBadge');
  var $activityTitle= document.getElementById('activityTitle');
  var $logContainer = document.getElementById('logContainer');
  var $logPlaceholder= document.getElementById('logPlaceholder');
  var $errorBox     = document.getElementById('errorBox');
  var $secureWarning= document.getElementById('secureWarning');
  var $noMidiWarning= document.getElementById('noMidiWarning');
  var $originUrl    = document.getElementById('originUrl');
  var $chLabels     = document.querySelectorAll('.ch-label');

  // ─── Secure context detection ───
  var isSecure = window.isSecureContext;
  var hasMidiApi = !!navigator.requestMIDIAccess;

  if (!hasMidiApi && !isSecure) {
    // Non-secure context — show flag instructions
    $secureWarning.classList.remove('hidden');
    $originUrl.textContent = window.location.origin;
  } else if (!hasMidiApi) {
    // Secure but no API (unsupported browser)
    $noMidiWarning.classList.remove('hidden');
  }

  // ─── Helpers ───
  function showError(msg) {
    $errorBox.textContent = msg;
    $errorBox.classList.remove('hidden');
  }
  function clearError() {
    $errorBox.classList.add('hidden');
    $errorBox.textContent = '';
  }

  function updateChannelLabels() {
    for (var i = 0; i < $chLabels.length; i++) {
      $chLabels[i].textContent = midiChannel;
    }
  }

  $channelInput.addEventListener('change', function() {
    var val = parseInt(this.value, 10);
    if (val >= 1 && val <= 16) { midiChannel = val; updateChannelLabels(); }
  });

  // ─── Socket.IO connection ───
  function connectSocket() {
    if (socket) return;
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', function() {
      console.log('[MidiBridge] Socket connected');
    });

    socket.on('disconnect', function() {
      console.log('[MidiBridge] Socket disconnected');
      setConnected(false);
    });

    socket.on('midi:joined', function(data) {
      clearError();
      setConnected(true, data.roomPin);
    });

    socket.on('midi:error', function(data) {
      showError(data.message || 'Unknown error');
      if (!connected) {
        $connectBtn.disabled = false;
        $connectBtn.textContent = 'Connect';
      }
    });

    socket.on('setlist:summary', function(data) {
      if (data && data.setlist) {
        setlist = data.setlist;
        renderSetlist();
      }
    });

    socket.on('session_expired', function() {
      showError('Session expired. Please reconnect.');
      setConnected(false);
    });
  }

  function setConnected(state, pin) {
    connected = state;
    if (state) {
      $connectRow.classList.add('hidden');
      $connectedRow.classList.remove('hidden');
      $connectedPin.textContent = pin || '';
      $connectBtn.disabled = false;
      $connectBtn.textContent = 'Connect';
    } else {
      $connectRow.classList.remove('hidden');
      $connectedRow.classList.add('hidden');
      $connectBtn.disabled = false;
      $connectBtn.textContent = 'Connect';
      setlist = [];
      renderSetlist();
      $lastCmdSection.classList.add('hidden');
    }
  }

  // ─── Connect / Disconnect ───
  $connectBtn.addEventListener('click', function() {
    var pin = $pinInput.value.trim();
    if (!pin) return;
    clearError();
    $connectBtn.disabled = true;
    $connectBtn.textContent = 'Connecting...';
    connectSocket();

    if (socket.connected) {
      socket.emit('midi:join', { pin: pin });
    } else {
      socket.once('connect', function() {
        socket.emit('midi:join', { pin: pin });
      });
    }

    // Timeout
    setTimeout(function() {
      if (!connected) {
        showError('Connection timed out. Check the PIN and try again.');
        $connectBtn.disabled = false;
        $connectBtn.textContent = 'Connect';
      }
    }, 10000);
  });

  $pinInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') $connectBtn.click();
  });

  $disconnectBtn.addEventListener('click', function() {
    if (socket) socket.emit('midi:leave');
    setConnected(false);
    setlist = [];
    midiLog = [];
    renderSetlist();
    renderLog();
  });

  // ─── Setlist rendering ───
  function renderSetlist() {
    $setlistTitle.textContent = 'Setlist' + (setlist.length > 0 ? ' (' + setlist.length + ' items)' : '');
    if (setlist.length === 0) {
      $setlistContent.innerHTML = '<div class="status-text" style="font-size:0.85rem">' +
        (connected ? 'Waiting for setlist from operator...' : 'Connect to see the setlist') + '</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < setlist.length; i++) {
      var bg = i % 2 === 0 ? ' style="background-color:#1f1f23"' : '';
      html += '<div class="setlist-item"' + bg + '>' +
        '<span class="setlist-idx">' + i + '</span>' +
        '<span class="setlist-title">' + escapeHtml(setlist[i].title) + '</span></div>';
    }
    $setlistContent.innerHTML = html;
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ─── Send command (with client-side throttle for CC-triggered repeats) ───
  var lastCommandTime = {};  // { 'slide:next': timestamp, ... }
  var THROTTLE_MS = 150;    // Max ~6 commands/sec per type (CC messages can send 50+/sec)

  function sendCommand(command) {
    if (!connected || !socket) return;

    // Throttle rapid-fire repeats of the same command type (e.g. CC mod wheel)
    // Exempt identity commands — they carry unique payloads and are already rate-limited by 2-note pairing
    var now = Date.now();
    if (command.type !== 'song:identify' && command.type !== 'item:identify') {
      var lastTime = lastCommandTime[command.type] || 0;
      if (now - lastTime < THROTTLE_MS) return;
    }
    lastCommandTime[command.type] = now;

    socket.emit('midi:command', { command: command });
    // Update last command badge
    var text = command.type;
    if (command.payload) text += ' ' + JSON.stringify(command.payload);
    $lastCmdBadge.textContent = text;
    $lastCmdSection.classList.remove('hidden');
  }

  // ─── Song identity decode (2-note pair) ───
  function decodeSongHash(note1, note2) {
    var part1 = (note1.pitch - 96) * 127 + (note1.velocity - 1);
    var part2 = (note2.pitch - 96) * 127 + (note2.velocity - 1);
    var minPart = Math.min(part1, part2);
    var maxPart = Math.max(part1, part2);
    return minPart * 4064 + maxPart;
  }

  function handleSongIdNote(pitch, velocity) {
    var now = Date.now();
    if (songIdBuffer && (now - songIdBuffer.time) < 1000) {
      // Second note — complete identity pair
      if (songIdTimer) { clearTimeout(songIdTimer); songIdTimer = null; }
      var itemHash = decodeSongHash(songIdBuffer, { pitch: pitch, velocity: velocity });
      songIdBuffer = null;

      if (connected) {
        // Capture CC 3 state NOW at pair-completion time, before the timeout.
        // If we read from global state inside setTimeout, a rapid second item's
        // CC 3 could overwrite this item's value during the 50ms delay.
        var capturedItemType = lastItemTypeCC;
        var capturedCCTime = itemTypeCCTime;
        lastItemTypeCC = -1; // Reset immediately after capture

        // Delay dispatch by 50ms so CC 3 can arrive first — DAWs may reorder
        // simultaneous MIDI events at the same tick, causing identity notes
        // to arrive before the CC 3 item-type indicator.
        setTimeout(function() {
          var hasTypeCC = capturedItemType >= 0 && (Date.now() - capturedCCTime) < 2000;
          if (hasTypeCC && capturedItemType > 0) {
            sendCommand({ type: 'item:identify', payload: { itemHash: itemHash, itemType: capturedItemType } });
          } else {
            sendCommand({ type: 'song:identify', payload: { songHash: itemHash } });
          }
        }, 50);
      }
    } else {
      // First note — buffer
      songIdBuffer = { pitch: pitch, velocity: velocity, time: now };
      if (songIdTimer) clearTimeout(songIdTimer);
      songIdTimer = setTimeout(function() {
        songIdBuffer = null;
        songIdTimer = null;
      }, 1000);
    }
  }

  // ─── MIDI message handler ───
  function handleMidiMessage(event) {
    var status = event.data[0];
    var data1 = event.data[1];
    var data2 = event.data[2];
    var messageType = status & 0xf0;
    var channel = (status & 0x0f) + 1;

    var now = new Date();
    var ts = now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');

    var typeLabel = '';
    var detail = '';

    switch (messageType) {
      case 0xc0: typeLabel = 'Program Change'; detail = 'program=' + data1; break;
      case 0x90: typeLabel = data2 > 0 ? 'Note On' : 'Note Off'; detail = 'note=' + data1 + ' vel=' + data2; break;
      case 0x80: typeLabel = 'Note Off'; detail = 'note=' + data1 + ' vel=' + data2; break;
      case 0xb0: typeLabel = 'CC'; detail = 'cc=' + data1 + ' val=' + data2; break;
      default: typeLabel = '0x' + messageType.toString(16); detail = 'd1=' + data1 + ' d2=' + (data2 != null ? data2 : '-');
    }

    var logEntry = ts + '  ch' + String(channel).padStart(2, ' ') + '  ' + typeLabel.padEnd(16) + ' ' + detail;
    midiLog.push(logEntry);
    if (midiLog.length > MAX_LOG) midiLog = midiLog.slice(-MAX_LOG);
    renderLog();

    // Command mapping — only on configured channel
    var command = null;

    if (messageType === 0x90 && data2 > 0 && channel === midiChannel) {
      if (data1 >= 96) {
        handleSongIdNote(data1, data2);
      } else if (data1 === 60) {
        command = { type: 'slide:blank' };
      } else if (data1 === 61) {
        command = { type: 'item:activate' };
      } else if (data1 === 62) {
        command = { type: 'item:pause' };
      } else if (data1 === 63) {
        command = { type: 'item:stop' };
      } else if (data1 === 64) {
        command = { type: 'item:loopOn' };
      } else if (data1 === 65) {
        command = { type: 'item:loopOff' };
      } else if (data1 <= 59) {
        command = { type: 'slide:goto', payload: { index: data1 } };
      }
    } else if (messageType === 0xb0 && channel === midiChannel) {
      if (data1 === 1 && data2 > 0) {
        command = { type: 'slide:next' };
      } else if (data1 === 2 && data2 > 0) {
        command = { type: 'slide:prev' };
      } else if (data1 === 3) {
        // CC 3: item type indicator — store context, don't send command
        lastItemTypeCC = data2;
        itemTypeCCTime = Date.now();
      }
    }

    if (command && connected) {
      sendCommand(command);
    }
  }

  // ─── Activity log rendering ───
  function renderLog() {
    $activityTitle.textContent = 'MIDI Activity' + (midiLog.length > 0 ? ' (' + midiLog.length + ')' : '');
    if (midiLog.length === 0) {
      $logContainer.innerHTML = '<div class="status-text" style="font-size:0.8rem" id="logPlaceholder">' +
        ($midiSelect.value ? 'Listening for MIDI messages...' : 'Select a MIDI input to start') + '</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < midiLog.length; i++) {
      html += '<div class="log-entry">' + escapeHtml(midiLog[i]) + '</div>';
    }
    $logContainer.innerHTML = html;
    $logContainer.scrollTop = $logContainer.scrollHeight;
  }

  // ─── Web MIDI setup ───
  function requestMidi() {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess({ sysex: false }).then(function(access) {
      midiAccess = access;
      updateMidiInputs();
      access.onstatechange = updateMidiInputs;
      $midiSelect.disabled = false;
    }).catch(function(err) {
      showError('MIDI access denied: ' + err.message);
    });
  }

  function updateMidiInputs() {
    if (!midiAccess) return;
    var current = $midiSelect.value;
    // Clear identity buffers on device state change (disconnect/reconnect)
    songIdBuffer = null;
    if (songIdTimer) { clearTimeout(songIdTimer); songIdTimer = null; }
    lastItemTypeCC = -1;
    itemTypeCCTime = 0;
    // Clear options except first placeholder
    while ($midiSelect.options.length > 1) $midiSelect.remove(1);
    var count = 0;
    midiAccess.inputs.forEach(function(input) {
      var opt = document.createElement('option');
      opt.value = input.id;
      opt.textContent = input.name || input.id;
      $midiSelect.appendChild(opt);
      count++;
    });
    // Restore selection if still present
    if (current) {
      for (var i = 0; i < $midiSelect.options.length; i++) {
        if ($midiSelect.options[i].value === current) { $midiSelect.value = current; break; }
      }
    }
    $noDevicesHint.textContent = count === 0 ? 'No MIDI devices detected' : '';
  }

  $midiSelect.addEventListener('change', function() {
    // Unbind previous
    if (activeInput) { activeInput.onmidimessage = null; activeInput = null; }
    // Clear buffered identity state to prevent stale data on device switch
    songIdBuffer = null;
    if (songIdTimer) { clearTimeout(songIdTimer); songIdTimer = null; }
    lastItemTypeCC = -1;
    itemTypeCCTime = 0;
    if (!midiAccess || !this.value) { renderLog(); return; }
    var input = midiAccess.inputs.get(this.value);
    if (input) {
      input.onmidimessage = handleMidiMessage;
      activeInput = input;
    }
    midiLog = [];
    renderLog();
  });

  // ─── Init ───
  if (hasMidiApi && isSecure) {
    requestMidi();
  }
  // If MIDI API exists but context might be insecure (some browsers still allow it), try anyway
  if (hasMidiApi && !isSecure) {
    requestMidi();
  }

  renderSetlist();
  renderLog();
})();
</script>
</body>
</html>`;
}
