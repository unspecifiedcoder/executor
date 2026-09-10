# How the demo video was made

The video is a screen recording of the dashboard itself — `record-ui.mjs` drives
`apps/dashboard` in headless Chrome at 1920x1080 and steps the on-page lifecycle
replay on fixed marks. Every frame is a page a judge can open.

It has no audio track, because ETHGlobal prohibits text-to-speech and AI
voiceover; the narration is read by a human against `docs/VOICEOVER_SCRIPT.md`.

## Why it drives the real UI

An earlier version of this recorder drove `console.html`, a page built only for
recording. It looked good and it was honest about its data, but it meant the
video and the live site were two different products — and the more convincing
one was the one nobody could visit. A judge who watched the video and then
opened the site would find the lifecycle nowhere. That was the wrong trade, and
the fix was to move the lifecycle into the product rather than to make the
recording prettier.

`console.html` and `build.py` are kept for reference and are no longer used.

## Running it

```bash
cd apps/dashboard && npx next build && npx next start -p 3100   # in one shell
node scripts/record-demo/record-ui.mjs                          # in another
ffmpeg -i out-ui/*.webm -an -c:v libx264 -crf 18 -pix_fmt yuv420p demo.mp4
```

The `-an` is not optional: the submission must carry no synthesised audio.

**Build, then start, then record — in that order.** Running `next build` while a
`next start` from a previous build is still serving leaves the browser asking
for chunk filenames the rebuild has replaced; the page loads, then dies on a
`ChunkLoadError` the moment it lazy-loads one. That cost a whole take, and the
symptom (half the video is a blank error screen) looks nothing like the cause.

## What the marks are

`MARKS` in `record-ui.mjs` are absolute end-of-segment times in seconds, and
`docs/VOICEOVER_SCRIPT.md` is written against them. Change one and change the
other, or the narration drifts out of sync with the picture.

The replay is stepped manually rather than left to autoplay: its own step holds
total about 34 seconds, which is the right pace for reading on a screen and the
wrong pace for a narrated video.
