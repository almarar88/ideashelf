# App icon

`icon-art.mjs` is the single source for every icon asset. `npm run icons`
rasterizes it into the Android mipmaps, the adaptive layers, the splash
drawables, and the PWA icons. Nothing is hand-edited downstream — change the
vector, re-run, rebuild.

## The mark

A domino mask split in two, the near half lifting away. The wedge of empty
space between the halves is the reveal: it is what makes the mark say *off*
rather than just *mask*.

Three concepts were drawn and compared on a contact sheet at 300 / 120 / 60 /
40 / 29px before this one was chosen:

- **A — a whole mask, tilted.** Rejected: the silhouette read as a sleep mask,
  and a tilt alone is too quiet to say "off".
- **B — split in two.** Chosen. The only one that states the idea in the
  silhouette itself, and it stays distinctive when small.
- **C — half a mask, one eye bare.** Rejected: at any real size the bare eye
  collapsed into a stray dot and the composition read as unbalanced.

The split geometry was then tuned across three throws. Anything wider than the
current offset and the halves stop reading as one object.

## Rules it is drawn against

- One idea, one silhouette, no text.
- Solid weighted forms — no thin strokes that vanish when downscaled.
- A single light source from above; the two halves carry different shadow
  weights so the lifted one reads as nearer the viewer.
- Two hues: violet ground, pearl subject.
- The subject spans ~55% of the canvas, so it survives the iOS squircle and
  every Android launcher mask (verified against circle, squircle, rounded
  square and teardrop).

## Layers

| Asset | Source | Notes |
| --- | --- | --- |
| `mipmap-*/ic_launcher.png` | `icon({rounded:true})` | legacy launchers, squircle baked in |
| `mipmap-*/ic_launcher_background.png` | `background()` | adaptive ground, full bleed |
| `mipmap-*/ic_launcher_foreground.png` | `foreground()` | adaptive subject, scaled into the 66% safe zone the launcher masks to |
| `drawable/ic_launcher_monochrome.xml` | hand-traced vector | Android 13+ themed icon; must stay a flat silhouette because the system tints it |
| `public/icon.svg` | `icon({rounded:true})` | PWA `purpose: any` |
| `public/icon-maskable.svg` | `icon({rounded:false})` | PWA `purpose: maskable`, full bleed |

`design/out/` holds review renders and is not committed.
