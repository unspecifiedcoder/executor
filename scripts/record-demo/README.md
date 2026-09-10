# How the demo video was made

The video is a screen recording, not an edit. It has no audio track, because
ETHGlobal prohibits text-to-speech and AI voiceover; the narration is read by a
human against `docs/VOICEOVER_SCRIPT.md`.

The point of keeping this toolchain in the repo is that **nothing on screen is
typed by hand**. The pipeline is:

1. **`prefetch.sh`** runs every command the video displays — `cast call`,
   `cast receipt`, `cast logs` — against live Sepolia, and writes the real
   output to `data/*.txt`. If a number in the video is wrong, this is the file
   that would have to be lying.
2. **`build.py`** assembles those captured outputs into the scene list, cut to
   the exact segment lengths published in `docs/VOICEOVER_SCRIPT.md`
   (22 / 23 / 23 / 22 / 22 / 22 / 26 / 20 seconds = 3:00).
3. **`console.html`** replays them on a fixed clock, so each segment ends on its
   boundary regardless of how long anything took to render.
4. **`record.mjs`** drives headless Chrome at 1920×1080 and records the whole
   run in one continuous take — the live dashboard, the console, and back.

Outputs are prefetched rather than executed live on camera for one reason:
segment boundaries have to be exact so the narration lines up. Every byte
displayed still came off the chain, minutes before the take.

```bash
./prefetch.sh && python3 build.py && node record.mjs
ffmpeg -i out/*.webm -an -c:v libx264 -crf 18 -pix_fmt yuv420p demo.mp4
```

The `-an` is not optional: the submission must carry no synthesised audio.
