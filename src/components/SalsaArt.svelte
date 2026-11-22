<script>
  // Stand-in for a photo: a top-down bowl of the salsa, generated from its
  // palette. The surface is the definitive colour; the flecks (seeds, herbs,
  // chile skin) use the rest. Seeded by slug, so it is the same on the server
  // and the client and never changes between visits.
  import { seededRandom } from '$lib/salsa';

  export let style;

  // [fleck count, max fleck radius] — chunky salsas get few big pieces,
  // blended ones a fine speckle
  const TEXTURE = {
    fresca: [34, 15],
    pickled: [26, 17],
    cooked: [70, 7],
    oil: [120, 5],
    mole: [46, 3.5],
    creamy: [40, 4],
    'dried-chile': [90, 4.5]
  };

  $: [surface, ...others] = style.palette;
  $: id = style.slug;
  $: flecks = (() => {
    const rand = seededRandom(style.slug);
    const [n, max] = TEXTURE[style.family] || [60, 6];
    return Array.from({ length: n }, () => {
      // sqrt keeps the scatter uniform over the disc instead of bunching centrally
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * 142;
      return {
        x: 200 + Math.cos(angle) * dist,
        y: 200 + Math.sin(angle) * dist,
        rx: max * (0.45 + rand() * 0.55),
        ry: max * (0.3 + rand() * 0.45),
        rot: rand() * 180,
        fill: others[Math.floor(rand() * others.length)],
        opacity: 0.6 + rand() * 0.4
      };
    });
  })();
</script>

<svg viewBox="0 0 400 400" role="img" aria-label="Illustration of {style.name}, generated from its colours">
  <defs>
    <!-- Wobbles every edge so nothing reads as a perfect ellipse -->
    <filter id="rough-{id}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7" />
      <feDisplacementMap in="SourceGraphic" scale="16" />
    </filter>
    <filter id="grain-{id}">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" />
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 0.95" />
    </filter>
    <radialGradient id="depth-{id}" cx="50%" cy="50%" r="50%">
      <stop offset="62%" stop-color="#000" stop-opacity="0" />
      <stop offset="100%" stop-color="#000" stop-opacity="0.38" />
    </radialGradient>
    <radialGradient id="sheen-{id}" cx="34%" cy="28%" r="34%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.34" />
      <stop offset="100%" stop-color="#fff" stop-opacity="0" />
    </radialGradient>
    <clipPath id="bowl-{id}"><circle cx="200" cy="200" r="158" /></clipPath>
  </defs>

  <!-- Stone bowl -->
  <circle cx="200" cy="200" r="186" fill="#33312e" />
  <circle cx="200" cy="200" r="186" filter="url(#grain-{id})" opacity="0.5" clip-path="circle(186px at 200px 200px)" />
  <circle cx="200" cy="200" r="185" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="2" />

  <!-- Salsa -->
  <g clip-path="url(#bowl-{id})">
    <g filter="url(#rough-{id})">
      <circle cx="200" cy="200" r="170" fill={surface} />
      {#each flecks as f}
        <ellipse
          cx={f.x}
          cy={f.y}
          rx={f.rx}
          ry={f.ry}
          fill={f.fill}
          opacity={f.opacity}
          transform="rotate({f.rot} {f.x} {f.y})"
        />
      {/each}
    </g>
    <rect width="400" height="400" filter="url(#grain-{id})" opacity="0.22" />
    <circle cx="200" cy="200" r="160" fill="url(#depth-{id})" />
    <circle cx="200" cy="200" r="160" fill="url(#sheen-{id})" />
  </g>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
