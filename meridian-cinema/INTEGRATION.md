# Wiring the Google Aquarium

Written against the real aquarium.js. The patch is two one-line insertions, so the stock
renderer (water, lighting, fog, fish models, shaders) stays untouched.

## Steps

1. Clone WebGLSamples/WebGLSamples.github.io. Copy its `aquarium/` and `tdl/` folders into `web/`
   so they sit side by side (`web/aquarium/`, `web/tdl/`). Check the license headers before reuse.
2. From the project root:

       node tools/patch-aquarium.mjs web/aquarium/aquarium.js web/aquarium/aquarium.html

   It writes `aquarium.js.bak`, inserts the two hooks, and adds one script tag to the html.
   It stops with an error if an anchor is missing or appears twice. Running it twice is safe.
3. `node server/index.js`, then open `http://localhost:8787/aquarium/aquarium.html`.

## What the hooks do

- Draw hook, right after `fish.drawPrep(fishConstInUse);` in `render()`. If `window.Meridian`
  exists, it draws every simulated fish of that model and skips the stock orbit loop.
  Without `window.Meridian` the sample behaves exactly as before.
- Step hook, before `requestAnimationFrame` in `onAnimationFrame()`. Advances the simulation
  once per frame. It is not in `render()` because that runs twice per frame in stereo.

## How entities map onto the stock renderer

- The stock code draws 5 models (`g_fishTable`). Sim species map to them in `bridge.js`:
  small -> SmallFishA, medium -> MediumFishA or B (stable per fish), big -> BigFishB, shark -> BigFishA.
- Heading: stock code sets `nextPosition` slightly behind the fish, so the bridge does the same
  from the velocity vector. If fish swim backwards, flip the sign of `HEAD` in `bridge.js`.
- Scale: `SCALE_DIV` in `bridge.js` maps sim scale into the stock 1 to 2 range per model.
- The stock shader has no alpha, so fade in and out is done by shrinking.
- Tank: `BOUNDS` and `CENTER_Y` in `bridge.js` fit the globe (radius 74, fish band around y 25).
- Tail animation: `TAIL_MULT` per model.
- The fish count buttons in the sample no longer control anything. The simulation decides the count.

## Known gaps

- Not run in a real browser. Node tests cover the bridge and the patch script against fixtures
  that contain the exact anchor lines, not the full file.
- VR path (`onXRFrame`) does not call the step hook. Skip VR for now.
- Laser mode (`L` key) is kept consistent but untested.
- If the `<script type="module">` runs after `main()` on your setup, the hooks fall back to stock
  fish for a moment. `window.Meridian` should exist before DOM ready, so this is unlikely.
