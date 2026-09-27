# What the reef integration actually does, stated plainly

Two fish populations share one scene, not one:

- **Native reef** (clownfish, chromis, anthias) -- ReefSimulation, completely untouched.
  Real gait, real reef obstacle avoidance, real social behavior.
- **Event fish** -- Meridian's own Simulation class (the same one written for the Google
  Aquarium path), rendered through the reef's real fish geometry and muscle-wave shader
  via two extra InstancedMesh pools (48 chromis-shaped, 32 anthias-shaped slots).

This means:

- A $5M event fish does **not** push native fish out of its way. The two populations
  don't see each other. Making that happen means giving event fish entries in
  ReefSimulation's own fish array and GAIT table -- a bigger change than this pass makes.
- Event fish swim in an open mid-water box (roughly y 3.4-7.0, |x| <= 8.4, z -0.8 to 4.2)
  and do not steer around rock or coral. They're mapped there by a fixed linear transform
  from Meridian's simulation space, clamped so a physics overshoot can't push a fish
  through the tank wall. They just don't dodge anything inside that box.
- Body bend (the C-turn the native fish do) is wired into the shader input but always
  sent as 0, because Meridian's simulation doesn't track a smoothed turning rate yet.
  Pectoral motion is a rough sinusoidal approximation, not the real per-species gait model.
- Pool sizes (48 / 32) are a guess based on the mock event size distribution, not
  measured against real Nansen traffic. If most live trades land in one size band, one
  pool will fill up while the other sits empty -- entities beyond a full pool just don't
  render that frame (they're not lost, they resume once a slot frees up... actually no,
  they're dropped for their lifetime if the pool stayed full whenever they were live).
  Retune the two numbers in `POOL` at the top of `meridian-bridge.js` once you've watched
  it run for a while.

# What's actually been checked, and how

No browser was available while building this, so nothing has been visually confirmed.
What was checked instead:

- `test/reef-bridge.mjs` runs the bridge against the real `three.module.js` under Node
  (vendored into `node_modules/three` so both the bridge and the test resolve the same
  module instance -- two different instances silently break `instanceof` checks like
  `isInstancedMesh`, which is what happened on the first attempt). It runs 90 simulated
  seconds of mock trades, decomposes every instance matrix every 5 seconds, and asserts
  no NaNs and every visible fish sits inside the mid-water box.
- `tools/check-web-links.mjs` parses every `.js`/`.html` file under `web/` for relative
  imports, `<script src>`, `<link href>`, import-map entries, and
  `new URL('...', import.meta.url)` asset loads, resolves each one using real URL
  semantics against the path it would be served at (not Node's file-based module
  resolution, which uses different math -- see below), and checks the target exists.
- The dev server was started and every path the reef page needs was fetched directly
  (`curl`): the HTML, the scene JS, the shared UI helpers, `three.module.js`, the rock
  geometry `.bin` files and textures, all 200.

One real bug this caught: `web/shared/controls.js` imports `../../ui/icons.js`. Under
Node's file-based resolution that pointed one place; under the browser's URL-based
resolution against this server's document root it points somewhere else entirely,
because this project's directory nesting doesn't exactly mirror the original repo's.
Trusting the Node-based check would have shipped a broken import. The URL-based
checker is the one that matches what a browser will actually request, so that's the one
this project relies on -- but neither one is a substitute for loading the page.

# The one thing that still can't be checked from here

Whether it looks right. Scale, speed, the swim-cycle approximation, and the mid-water
zone boundaries are all first-guess numbers. Send a screenshot.
