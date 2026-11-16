# MechBridge clay scroll background

Real-3D clay background for the MechBridge site. Ten small pieces tell the story:
house → design → foundation → construction → plumbing → airflow → electrical → solar → inspection → happy face.
A thin clay cord links them. Pieces build up and squash away with scroll, every piece has a never-idle loop,
and the ground colour shifts between blue and beige as you scroll.

Live design canvas: https://claude.ai/artifact/MmMXzKSRmiSkVpLAEVpBoy (private to the owner until shared)

## Files

| File | What it is |
|---|---|
| `index.html` | Working demo and the minimal integration example |
| `mb-clay-background.js` | Standalone build of the logic (exposes `window.MechBridgeBackground.mount`) |
| `vendor/three.min.js` | three.js r159 classic build, about 670 KB, loaded before the script above |
| `source/Main.dc.html` | The design-canvas source (same logic, canvas format). Edit here to round-trip with the canvas |
| `source/canvas.json` | Canvas index (board size 1440 × 7600) |

## Put it on the site

1. Copy this folder next to the site and include `vendor/three.min.js`, then `mb-clay-background.js`.
2. Add the wrapper and canvas, as in `index.html`. Content goes in a layer above it (`position: relative; z-index: 1`, transparent background) so the background shows through.
3. Call `MechBridgeBackground.mount(wrapper, canvas, props)`.

The wrapper's height is split into 10 equal sections (7600 px gives 760 px each), so make the wrapper as tall as the page, or
tall enough that each section lines up with a page section. The canvas must be `position: sticky; top: 0; height: 100vh`.

Props: `motion` (`Scroll` default, `Autoplay`, `Static`), `stopMotion` (false = smooth; true = 12 fps claymation stepping), `colorShift` (true/false).
Reduced-motion users get assembled, still pieces. With no WebGL the page shows only the shifting ground colour.

## Where to edit things (all in the `Component` class)

| To change | Look at |
|---|---|
| Piece positions (`x` = fraction of width, `y` = fraction of its section) and rotation (`yaw`, `tilt`) | `_layout()` |
| Piece size (15% of a section, then ×0.6 on desktop ≥ 900 px) | `_resize()`, the `side` line |
| Ground and cord colours per section | `_stops()` (ground and cord arrays, ten entries each) |
| Blend distance between sections | `_colours()`, `half` |
| A piece's shapes, colours and loop | the `_house`, `_design`, `_foundation`, `_construction`, `_plumbing`, `_airflow`, `_electrical`, `_solar`, `_inspection`, `_happy` methods |
| Colour palette used by pieces | `_C()` (brand hex values) |
| Clay look (roughness, bump, wobble) | `_mat()`, `_bumpTex()`, `_wob()` |
| Lighting and shadows | `_setup()` |
| Cord thickness and path | `_resize()` (waypoint list and `rad`) |
| Build/squash timing | `_tick()` (`lo`, `hi`, the per-part `tin`/`tout`) |

Each piece method receives a kit `k` (`k.M` mesh, `k.G` group, `k.box`, `k.sph`, `k.cyl`, `k.cap`, `k.tor`, `k.tube`, `k.ext`, `k.curve`, `k.puck`)
and returns an animation function `(t) => {...}` called each frame with seconds. To add an 11th piece, write a new method,
add an entry to `_layout()`, and add an eleventh colour to `_stops()`; the page then splits into 11 sections only if you
also change the `10` in `_resize()`, `_colours()`, `_stops()` and `_tick()`.

## Brand rules used

Colours come from the MechBridge brand theme: Midnight Navy `#1A2841`, Old Cream `#F0E1CE`, Vintage Red `#B11722`, with
their scales. Grounds only alternate blue and beige; red appears on clay objects and the cord. Flat ground, no gradients.

## Notes and known limits

- The canvas version and this standalone build share the same logic; edit `source/Main.dc.html` and re-extract, or edit the JS directly.
- The cord crosses the content column once at each section boundary.
- Fast scrolling can show slight shake because the sticky canvas and the redraw are not perfectly in step; this is a browser limit.
- Not tested at true phone size on a real device.
- `source/Main.dc.html` loads three.js from the canvas's own asset store (`/_blob/...`). Outside the canvas it will not load; use `index.html` plus `mb-clay-background.js` instead.
