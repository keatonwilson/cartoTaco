<script>
  // Where one salsa sits among the others: every salsa as a dot on two axes
  // the reader picks, with this salsa and its closest relatives labelled and
  // joined. Each dot wears its salsa's own colour; names carry identity for the
  // labelled ones and a hover/focus tooltip for the rest, and the table below
  // gives the same numbers without the chart.
  import { AXES, axisValue, shortName, seededRandom } from '$lib/salsa';

  export let styles = [];
  export let style;
  export let related = [];

  let xKey = 'heat';
  let yKey = 'rich';
  let hovered = null;

  // Open on the two axes that spread this salsa and its relatives furthest
  // apart, so the labelled dots start as legible as the data allows
  function widestAxes(group) {
    const spread = (key) => {
      const values = group.map((s) => axisValue(s, key));
      return Math.max(...values) - Math.min(...values);
    };
    return [...AXES].sort((a, b) => spread(b.key) - spread(a.key)).map((a) => a.key);
  }
  $: [xKey, yKey] = widestAxes([style, ...related]);

  // Plot box inside the 640×420 viewBox
  const BOX = { left: 56, right: 618, top: 22, bottom: 356 };
  const TICKS = [0, 5, 10];
  const toX = (v) => BOX.left + (v / 10) * (BOX.right - BOX.left);
  const toY = (v) => BOX.bottom - (v / 10) * (BOX.bottom - BOX.top);

  $: xAxis = AXES.find((a) => a.key === xKey);
  $: yAxis = AXES.find((a) => a.key === yKey);
  $: relatedSlugs = new Set(related.map((s) => s.slug));

  // Scores are whole or half numbers, so salsas pile up on the same point.
  // A small offset, fixed per salsa, keeps every dot reachable.
  function jitter(slug) {
    const rand = seededRandom(`map-${slug}`);
    return [(rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5];
  }

  $: points = styles
    .map((s) => {
      const [jx, jy] = jitter(s.slug);
      const role = s.slug === style.slug ? 'focus' : relatedSlugs.has(s.slug) ? 'relative' : 'other';
      const x = toX(Math.min(10, Math.max(0, axisValue(s, xKey) + jx)));
      const y = toY(Math.min(10, Math.max(0, axisValue(s, yKey) + jy)));
      return { style: s, role, x, y, r: role === 'focus' ? 13 : role === 'relative' ? 9 : 6 };
    })
    // Paint order: others, then relatives, then this salsa on top
    .sort((a, b) => ['other', 'relative', 'focus'].indexOf(a.role) - ['other', 'relative', 'focus'].indexOf(b.role));

  $: focus = points.find((p) => p.role === 'focus');

  // Relatives sit close together by definition, so their names would stack.
  // Walk the labelled dots top to bottom and push each name down until it
  // clears the ones already placed near it. → Map<slug, extra y in px>
  $: labelShift = (() => {
    const placed = [];
    const shift = new Map();
    for (const p of points.filter((q) => q.role !== 'other').sort((a, b) => a.y - b.y)) {
      let y = p.y;
      for (const other of placed) {
        if (Math.abs(other.x - p.x) < 190 && y - other.y < 21) y = other.y + 21;
      }
      placed.push({ x: p.x, y });
      shift.set(p.style.slug, y - p.y);
    }
    return shift;
  })();
  $: tableRows = [style, ...related];

  // The two pickers never show the same axis: choosing one that the other
  // already has swaps them
  function pick(which, key) {
    if (which === 'x') {
      if (key === yKey) yKey = xKey;
      xKey = key;
    } else {
      if (key === xKey) xKey = yKey;
      yKey = key;
    }
  }

  const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(1));
</script>

<div class="salsa-map">
  <div class="pickers">
    <label>
      <span>Across</span>
      <select value={xKey} on:change={(e) => pick('x', e.currentTarget.value)}>
        {#each AXES as a}<option value={a.key}>{a.label}</option>{/each}
      </select>
    </label>
    <label>
      <span>Up</span>
      <select value={yKey} on:change={(e) => pick('y', e.currentTarget.value)}>
        {#each AXES as a}<option value={a.key}>{a.label}</option>{/each}
      </select>
    </label>
  </div>

  <div class="scroll">
  <div class="plot">
    <svg viewBox="0 0 640 420" role="group" aria-label="{style.name} and the other salsas by {xAxis.label} and {yAxis.label}">
      <!-- Grid and axes: recessive -->
      {#each TICKS as t}
        <line class="grid" x1={toX(t)} x2={toX(t)} y1={BOX.top} y2={BOX.bottom} />
        <line class="grid" x1={BOX.left} x2={BOX.right} y1={toY(t)} y2={toY(t)} />
        <text class="tick" x={toX(t)} y={BOX.bottom + 18} text-anchor="middle">{t}</text>
        <text class="tick" x={BOX.left - 10} y={toY(t) + 4} text-anchor="end">{t}</text>
      {/each}

      <text class="end" x={BOX.left} y="400">← {xAxis.low}</text>
      <text class="axis-title" x={(BOX.left + BOX.right) / 2} y="400" text-anchor="middle">{xAxis.label}</text>
      <text class="end" x={BOX.right} y="400" text-anchor="end">{xAxis.high} →</text>

      <text class="end" transform="translate(16 {BOX.bottom}) rotate(-90)">← {yAxis.low}</text>
      <text class="axis-title" transform="translate(16 {(BOX.top + BOX.bottom) / 2}) rotate(-90)" text-anchor="middle">
        {yAxis.label}
      </text>
      <text class="end" transform="translate(16 {BOX.top}) rotate(-90)" text-anchor="end">{yAxis.high} →</text>

      <!-- This salsa joined to its relatives -->
      {#each points.filter((p) => p.role === 'relative') as p (p.style.slug)}
        <line class="tie" x1={focus.x} y1={focus.y} x2={p.x} y2={p.y} />
      {/each}

      {#each points as p (p.style.slug)}
        <a
          href="/salsa/{p.style.slug}"
          class="mark {p.role}"
          style="transform:translate({p.x}px,{p.y}px)"
          aria-label="{p.style.name}: {xAxis.label} {fmt(axisValue(p.style, xKey))}, {yAxis.label} {fmt(axisValue(p.style, yKey))}"
          on:pointerenter={() => (hovered = p)}
          on:pointerleave={() => (hovered = null)}
          on:focus={() => (hovered = p)}
          on:blur={() => (hovered = null)}
        >
          <!-- hit target larger than the dot -->
          <circle r="18" fill="transparent" />
          <circle class="halo" r={p.r + 2.5} />
          <circle class="dot" r={p.r} fill={p.style.palette[0]} />
          {#if p.role !== 'other'}
            <text
              class="name"
              x={p.x > 500 ? -(p.r + 7) : p.r + 7}
              y={4 + (labelShift.get(p.style.slug) || 0)}
              text-anchor={p.x > 500 ? 'end' : 'start'}
            >
              {shortName(p.style.name)}
            </text>
          {/if}
        </a>
      {/each}
    </svg>

    {#if hovered}
      <div class="tip" style="left:{(hovered.x / 640) * 100}%;top:{(hovered.y / 420) * 100}%">
        <strong><span class="chip" style="background:{hovered.style.palette[0]}"></span>{hovered.style.name}</strong>
        <span>{xAxis.label} {fmt(axisValue(hovered.style, xKey))} · {yAxis.label} {fmt(axisValue(hovered.style, yKey))}</span>
      </div>
    {/if}
  </div>
  </div>

  <div class="table-wrap">
    <table>
      <caption>{shortName(style.name)} and its closest relatives, each axis scored 0–10</caption>
      <thead>
        <tr>
          <th scope="col">Salsa</th>
          {#each AXES as a}
            <th scope="col" class:active={a.key === xKey || a.key === yKey}>{a.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each tableRows as s, i (s.slug)}
          <tr class:self={i === 0}>
            <th scope="row">
              <span class="chip" style="background:{s.palette[0]}"></span>
              {#if i === 0}{shortName(s.name)}{:else}<a href="/salsa/{s.slug}">{shortName(s.name)}</a>{/if}
            </th>
            {#each AXES as a}
              <td class:active={a.key === xKey || a.key === yKey}>{fmt(axisValue(s, a.key))}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .pickers {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 22px;
    margin-bottom: 14px;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  select {
    padding: 6px 28px 6px 12px;
    border: 1px solid var(--line-2);
    border-radius: 999px;
    background-color: transparent;
    color: var(--ink-1);
    font: 500 13px/1.2 var(--font-text);
    letter-spacing: 0;
    text-transform: none;
    cursor: pointer;
  }

  select:focus-visible {
    outline: 2px solid var(--ink-1);
    outline-offset: 2px;
  }

  /* On a phone the chart keeps a readable size and scrolls sideways. The top
     padding is room for the tooltip, which a scroll container would clip. */
  .scroll {
    margin-top: -56px;
    padding-top: 56px;
    overflow-x: auto;
  }

  .plot {
    position: relative;
    min-width: 540px;
    max-width: 780px;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .grid {
    stroke: var(--line-1);
    stroke-width: 1;
  }

  .tick,
  .end,
  .axis-title {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    fill: var(--ink-3);
  }

  .axis-title {
    fill: var(--ink-1);
    font-weight: 600;
  }

  .tie {
    stroke: var(--ink-1);
    stroke-width: 1;
    stroke-opacity: 0.35;
    stroke-dasharray: 3 3;
  }

  .mark {
    transition: transform 0.6s cubic-bezier(0.3, 0.9, 0.25, 1);
    outline: none;
  }

  /* Surface-coloured ring separates overlapping dots; the hairline keeps pale
     salsas visible against the page */
  .halo {
    fill: var(--surface-1);
  }

  .dot {
    stroke: var(--ink-1);
    stroke-opacity: 0.3;
    stroke-width: 1;
  }

  .other .dot {
    fill-opacity: 0.75;
  }

  .focus .dot {
    stroke-opacity: 1;
    stroke-width: 2;
  }

  .mark:hover .dot,
  .mark:focus-visible .dot {
    stroke-opacity: 1;
    stroke-width: 2;
    fill-opacity: 1;
  }

  .name {
    font-family: var(--font-display);
    font-size: 15px;
    fill: var(--ink-1);
    paint-order: stroke;
    stroke: var(--surface-1);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .focus .name {
    font-size: 18px;
    font-weight: 600;
  }

  .tip {
    position: absolute;
    z-index: 2;
    transform: translate(-50%, calc(-100% - 20px));
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--ink-1);
    color: var(--surface-1);
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
  }

  .tip strong {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 500;
  }

  .chip {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--line-2);
  }

  .tip .chip {
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
  }

  .table-wrap {
    margin-top: 18px;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  caption {
    padding-bottom: 8px;
    text-align: left;
    font-size: 12px;
    color: var(--ink-2);
  }

  th,
  td {
    padding: 8px 10px;
    border-top: 1px solid var(--line-1);
    text-align: right;
    white-space: nowrap;
  }

  thead th {
    border-top: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  th:first-child {
    text-align: left;
  }

  tbody th {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 400;
  }

  tbody th a {
    color: inherit;
    text-underline-offset: 0.16em;
  }

  .self th,
  .self td {
    font-weight: 600;
  }

  /* The two axes currently on the chart */
  .active {
    background: var(--line-1);
    color: var(--ink-1);
  }

  @media (prefers-reduced-motion: reduce) {
    .mark {
      transition: none;
    }
  }
</style>
