# Meridian Cinema

Nansen smart money trades -> CinemaEvent -> simulation -> fish, rendered in a real
Three.js aquarium (Desktop Habitats' Reefscape, MIT licensed, bundled under `web/`).

## Run

    node server/index.js          # mock mode, no key needed
    open http://localhost:8787/reefscape/index.html

The native reef (clownfish, chromis, anthias, coral, shrimp) runs untouched as the
ambient population. Trade events swim as a separate pool of chromis (small/medium
trades) and anthias (big/shark trades) in open mid-water, driven by Meridian's own
simulation. See CAVEATS.md for exactly what this does and doesn't do yet.

There's also `/index.html`, the flat 2D debug view from before the reef was wired in.
It's still useful for eyeballing event flow without waiting on the 3D scene to load.

Live mode: copy `.env.example` to `.env`, set `MERIDIAN_MODE=live` and `NANSEN_API_KEY`,
start with `CHAINS=solana` only. Set `RECORD=1` once to save live events to
`data/session.ndjson`, then run `MERIDIAN_MODE=replay` to play them back sped up
(`REPLAY_SPEED`). Record your demo from replay, since the API only keeps 24 hours.

    npm test                      # normalizer, dedupe, simulation, reef bridge, patch script
    node tools/check-web-links.mjs   # verifies every relative import/asset path resolves

## Layout

    server/nansen.js          only file that calls Nansen (key stays here)
    server/normalize.js       raw trade -> CinemaEvent
    server/poller.js          one shared poll loop, live | mock | replay, batch spread
    server/index.js           SSE at /api/stream, health at /api/health, serves /web
    web/src/mapper.js         USD -> scale, species, speed, lane, direction (all tuning)
    web/src/simulation.js     entities, steering, lifecycle, getRenderState() buffer
    web/src/main.js           the 2D debug view at /
    web/reefscape/            Desktop Habitats' Reefscape scene, MIT licensed, bundled
    web/reefscape/src/meridian-bridge.js   drives event fish through the reef's real
                               fish geometry/shader as a second, separate InstancedMesh
                               population alongside the native reef fish
    web/aquarium/, tools/patch-aquarium.mjs   the earlier Google WebGL Aquarium path,
                               kept as a fallback; INTEGRATION.md covers it

## Status

Verified here (Node, no browser available in this build environment):
- normalizer, dedupe, simulation (no NaNs over 2 min)
- server SSE, static serving, health route, all 200s over HTTP including reef assets
- reef bridge: instancing/geometry/shader wiring runs under Node with the real
  three.module.js, no NaNs or corrupt matrices over 90s of synthetic events, every
  entity drawn in exactly one pool slot
- every relative import and asset path in web/ resolves under the same URL semantics
  a browser will use (tools/check-web-links.mjs), including the ui/icons.js path that
  broke on the first attempt (see CAVEATS.md)

Not verified: live Nansen calls (no key or network in the build sandbox), and nothing
has been seen rendered in an actual browser. Send a screenshot from
`/reefscape/index.html` and the next pass tunes scale, speed and the mid-water zone
against what you actually see.

Before any public launch, get Nansen approval for redistributing smart money data.
