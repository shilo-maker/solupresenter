# MIDI Bridge Setup Guide — FL Studio to SoluPresenter

Control your SoluPresenter lyrics and slides directly from FL Studio using MIDI. This lets you automate song selection and slide changes synced to your DAW timeline.

---

## What You Need

- **SoluPresenter desktop app** (logged in, connected online)
- **FL Studio** (any version with MIDI Out plugin)
- **A virtual MIDI port** — e.g. [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) (free) or [LoopBe1](https://www.nerds.de/en/loopbe1.html) (free)
- **Chrome or Edge browser** (Firefox/Safari don't support Web MIDI)

---

## Step 1 — Install a Virtual MIDI Port

The virtual MIDI port connects FL Studio's output to the browser's MIDI Bridge page.

1. Download and install **loopMIDI** from https://www.tobias-erichsen.de/software/loopmidi.html
2. Open loopMIDI
3. Type a name (e.g. `SoluPresenter`) in the "New port-name" field
4. Click the **+** button to create the port
5. Leave loopMIDI running (minimize it to the system tray)

> loopMIDI creates a virtual cable — FL Studio sends MIDI out one end, the browser receives it on the other.

---

## Step 2 — Set Up FL Studio

1. Open your FL Studio project
2. Add a **MIDI Out** plugin to a Mixer insert or as a Channel:
   - Go to the Channel Rack
   - Click the **+** button → **Add one** → **MIDI Out**
3. In the MIDI Out plugin window, configure:
   - **Port**: Set to the port number that routes to your loopMIDI port
     - Go to FL Studio → **Options** → **MIDI Settings**
     - Under **Output**, find your loopMIDI port (e.g. `SoluPresenter`)
     - Enable it and note the **port number** (e.g. port 0)
     - Back in MIDI Out plugin, set **Port** to match
   - **Channel**: Set to **16** (this is the default the MIDI Bridge expects)

### Configure the Knobs

The MIDI Out plugin has knobs on its front page. You need two of them:

**Knob for "Next Slide":**
1. Right-click a knob → **Configure**
2. Set **Controller** to **1** (CC 1 — Mod Wheel)
3. Leave Range at 0–127, leave Channel as-is
4. Close the configure window

**Knob for "Previous Slide":**
1. Right-click another knob → **Configure**
2. Set **Controller** to **2** (CC 2)
3. Close the configure window

---

## Step 3 — Connect Online in SoluPresenter

1. Open the SoluPresenter desktop app
2. Log in to your account
3. Click the **Displays** button in the header bar
4. Make sure you're connected online (the status dot should be lit)
5. Click your **username** in the top-right → note your **Room PIN** (you can click Copy)

---

## Step 4 — Open the MIDI Bridge Page

1. Open **Chrome** or **Edge**
2. Go to: **https://solucast.app/midi-bridge**
3. The browser will ask for MIDI access permission — click **Allow**
4. Enter your **Room PIN** and click **Connect**
5. Under **MIDI Input**, select your loopMIDI port from the dropdown
6. Set **Channel** to **16** (should be default)
7. You should see your **Setlist** appear with `PC 0`, `PC 1`, etc. next to each song

---

## Step 5 — Test It

With everything connected:

| What to do in FL Studio | What happens in SoluPresenter |
|---|---|
| Turn the **CC 1 knob** (or automate it) | Slide advances forward |
| Turn the **CC 2 knob** | Slide goes back |
| Change the **Patch** value to 0, 1, 2... | Switches to that song in the setlist |
| Play a **note** in the piano roll (on ch 16) | Jumps to that slide number (note 0 = slide 1) |

Check the **MIDI Activity** log at the bottom of the bridge page — every message shows up there in real time.

---

## Step 6 — Automate in Your Arrangement

This is where it gets powerful. In FL Studio's Playlist:

### Automate Song Changes
1. In the MIDI Out plugin, right-click the **Patch** dropdown
2. Click **Create automation clip**
3. In the Playlist, draw the automation:
   - Value 0 at the start of Song 1
   - Value 1 where Song 2 begins
   - Value 2 where Song 3 begins
   - etc.

### Automate Slide Advances
1. Right-click the **CC 1 knob** (the one you configured as Controller 1)
2. Click **Create automation clip**
3. Draw short spikes (0 → 127 → 0) at each point where the slide should advance

### Jump to Specific Slides
1. Open the **Piano Roll** for the MIDI Out channel
2. Place notes where you want slide jumps:
   - Note C0 (note number 0) = first slide
   - Note C#0 (note number 1) = second slide
   - Note D0 (note number 2) = third slide
   - etc.
3. Make sure the notes are on **Channel 16**

---

## MIDI Mapping Reference

| MIDI Message | Channel | Action | Details |
|---|---|---|---|
| Program Change | Any | Select song from setlist | PC 0 = first song, PC 1 = second, etc. |
| Note On | 16* | Jump to specific slide | Note number = slide index (0-based) |
| CC 1 (value > 0) | 16* | Next slide | Any value above 0 triggers it |
| CC 2 (value > 0) | 16* | Previous slide | Any value above 0 triggers it |

*Channel is configurable in the MIDI Bridge page (default 16).

---

## Troubleshooting

**No MIDI devices show up in the bridge page**
- Make sure loopMIDI is running
- Use Chrome or Edge (not Firefox/Safari)
- The page must be served over HTTPS or localhost
- Try refreshing the page after starting loopMIDI

**Setlist doesn't appear in the bridge page**
- Make sure SoluPresenter is connected online
- Make sure you have songs in your setlist (not just in the library)
- Try adding/removing a song from the setlist to force a refresh

**Program Change doesn't switch songs**
- Check that the setlist is visible in the bridge page (`PC 0 | Song Title`)
- If the setlist is empty, the bridge can't map PC numbers to songs

**Knob changes don't do anything**
- Check the MIDI Activity log — are messages appearing?
- Verify the knob's Controller number is 1 or 2 (right-click → Configure)
- Verify Channel is set to 16 in both FL Studio and the bridge page

**High latency**
- Both SoluPresenter and the bridge connect to the server over the internet
- For lowest latency, make sure you're on a stable connection
- The bridge page shows timestamps in the activity log — use these to measure delay

---

## Quick Reference (Cheat Sheet)

```
loopMIDI port → FL Studio MIDI Out (port X, channel 16)
                              ↓
              Browser: solucast.app/midi-bridge
                   (select loopMIDI input, ch 16)
                              ↓
                    SoluPresenter (online)

CC 1 knob  → Next Slide
CC 2 knob  → Previous Slide
Patch 0-127 → Select Song (by setlist position)
Note 0-127  → Jump to Slide (by index)
```
