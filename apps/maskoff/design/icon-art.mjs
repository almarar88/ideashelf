/**
 * MaskOff AI — app icon artwork. Single source for every rendered asset.
 *
 * Concept: a domino mask split in two, the near half lifting away. The wedge
 * of empty space between the halves is the reveal — it is what makes the mark
 * say "off" rather than just "mask".
 *
 * Constraints it is drawn against:
 *  - One idea, one silhouette, no text.
 *  - Solid weighted forms, no thin strokes that vanish when downscaled; the
 *    mark still reads at 29px (verified on a contact sheet, design/out/).
 *  - A single light source from above; two hues only (violet ground, pearl
 *    subject) plus the shadow.
 *  - Generous optical margin — the subject spans ~55% of the canvas, so the
 *    art survives both the iOS squircle and Android's launcher masks.
 */

export const PALETTE = {
  deep: "#3E1478",
  mid: "#170A2C",
  dark: "#06050A",
  glow: "#A855F7",
  pearl: "#FFFFFF",
  ice: "#BFD0F2",
};

/** Domino mask: cat-eye lift at the top corners, crisp notch over the nose. */
const DOMINO = `M 236 462
C 268 412, 372 382, 512 382 C 652 382, 756 412, 788 462
C 802 482, 796 508, 774 522 C 736 566, 684 592, 630 592
C 590 592, 554 572, 512 572 C 470 572, 434 592, 394 592
C 340 592, 288 566, 250 522 C 228 508, 222 482, 236 462 Z`
  .replace(/\s+/g, " ")
  .trim();

const EYES = `
  <ellipse cx="396" cy="476" rx="64" ry="41" transform="rotate(-12 396 476)" fill="#000"/>
  <ellipse cx="628" cy="476" rx="64" ry="41" transform="rotate(12 628 476)" fill="#000"/>`;

// Geometry settled on after comparing three throws on a contact sheet: any
// wider and the halves stop reading as one object.
const SPLIT = { gap: 26, liftX: 40, liftY: -22, rotL: -7, rotR: 8, angle: -10 };

const groundDefs = `
    <linearGradient id="ground" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="${PALETTE.deep}"/>
      <stop offset="0.5" stop-color="${PALETTE.mid}"/>
      <stop offset="1" stop-color="${PALETTE.dark}"/>
    </linearGradient>
    <radialGradient id="key" cx="0.5" cy="0.06" r="0.72">
      <stop offset="0" stop-color="${PALETTE.glow}" stop-opacity="0.38"/>
      <stop offset="1" stop-color="${PALETTE.glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig" cx="0.5" cy="0.48" r="0.75">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.42"/>
    </radialGradient>`;

const subjectDefs = `
    <linearGradient id="pearlL" x1="0.1" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#F2F5FD"/><stop offset="1" stop-color="${PALETTE.ice}"/>
    </linearGradient>
    <linearGradient id="pearlR" x1="0.1" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${PALETTE.pearl}"/><stop offset="1" stop-color="#DCE5F8"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.9"/>
      <stop offset="0.34" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="shL" x="-40%" y="-40%" width="180%" height="200%">
      <feDropShadow dx="-6" dy="18" stdDeviation="18" flood-color="#04020A" flood-opacity="0.55"/>
    </filter>
    <filter id="shR" x="-40%" y="-40%" width="180%" height="200%">
      <feDropShadow dx="-16" dy="34" stdDeviation="26" flood-color="#04020A" flood-opacity="0.72"/>
    </filter>
    <mask id="cut"><path d="${DOMINO}" fill="#fff"/>${EYES}</mask>
    <clipPath id="halfL">
      <rect x="-200" y="-200" width="${712 - SPLIT.gap / 2}" height="1424" transform="rotate(${SPLIT.angle} 512 500)"/>
    </clipPath>
    <clipPath id="halfR">
      <rect x="${512 + SPLIT.gap / 2}" y="-200" width="900" height="1424" transform="rotate(${SPLIT.angle} 512 500)"/>
    </clipPath>`;

/** The two mask halves, with a specular sheen along each top edge. */
const subject = `
    <g transform="translate(0 28)">
      <g filter="url(#shL)" transform="rotate(${SPLIT.rotL} 512 500)">
        <g mask="url(#cut)"><g clip-path="url(#halfL)">
          <path d="${DOMINO}" fill="url(#pearlL)"/>
          <path d="${DOMINO}" fill="url(#sheen)"/>
        </g></g>
      </g>
      <g filter="url(#shR)" transform="translate(${SPLIT.liftX} ${SPLIT.liftY}) rotate(${SPLIT.rotR} 512 500)">
        <g mask="url(#cut)"><g clip-path="url(#halfR)">
          <path d="${DOMINO}" fill="url(#pearlR)"/>
          <path d="${DOMINO}" fill="url(#sheen)"/>
        </g></g>
      </g>
    </g>`;

const svg = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>${defs}</defs>
${body}
</svg>`;

/**
 * The complete icon.
 * @param {{rounded?: boolean}} opts rounded bakes the squircle, for contexts
 *   that do not mask the artwork themselves (PWA "any", Android legacy).
 */
export function icon({ rounded = true } = {}) {
  const clip = rounded ? `<clipPath id="sq"><rect width="1024" height="1024" rx="228"/></clipPath>` : "";
  const open = rounded ? `  <g clip-path="url(#sq)">` : "  <g>";
  return svg(
    `${clip}${groundDefs}${subjectDefs}`,
    `${open}
    <rect width="1024" height="1024" fill="url(#ground)"/>
    <rect width="1024" height="1024" fill="url(#key)"/>${subject}
    <rect width="1024" height="1024" fill="url(#vig)"/>
  </g>`,
  );
}

/** Android adaptive icon: ground layer only, full bleed. */
export function background() {
  return svg(
    groundDefs,
    `  <rect width="1024" height="1024" fill="url(#ground)"/>
  <rect width="1024" height="1024" fill="url(#key)"/>
  <rect width="1024" height="1024" fill="url(#vig)"/>`,
  );
}

/**
 * Android adaptive icon: subject layer only.
 *
 * The launcher masks to the central 66% and parallaxes the layer, so the
 * subject is scaled down to stay inside that safe zone whatever shape the
 * device's launcher applies.
 */
export function foreground({ scale = 0.82 } = {}) {
  return svg(
    subjectDefs,
    `  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${subject}
  </g>`,
  );
}
