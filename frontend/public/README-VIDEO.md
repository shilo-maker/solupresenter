# Generating the Keepalive Video

The `transparent-keepalive.webm` file is needed for screensaver prevention on Chromecast.

## Option 1: Use the browser-based generator

1. Open `http://localhost:3000/generate-video.html` in your browser (after running `npm start`)
2. Wait for the video to generate
3. Click "Download Video"
4. Save it as `transparent-keepalive.webm` in this directory (`frontend/public/`)

## Option 2: Use FFmpeg (if installed)

```bash
cd frontend/public
ffmpeg -f lavfi -i color=c=black:s=64x64:d=1 -c:v libvpx -b:v 50k -an transparent-keepalive.webm
```

## Option 3: Download a sample

You can use any tiny looping video file. Even a 1-second black video works.

The file should be:
- Small filesize (< 10KB ideally)
- 1 second duration
- Minimal resolution (64x64 or similar)
- WebM or MP4 format
