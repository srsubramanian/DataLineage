# Handoff: Attribute Lineage Matrix (Transaction Research)

## Overview
An internal page that shows the lineage of every data attribute in the **Transaction Research UI**, traced through four layers to its source:

`UI field → BFF API (REST) → Data API (GraphQL client) → GraphQL gateway → Snowflake column`

Audience: engineers debugging, data/governance teams, product/BAs. Core jobs:
1. Find a field and see its full chain plus the transformation applied at each hop.
2. Select any upstream column and see which UI fields it impacts.
3. Spot coverage problems: broken mappings and fields with no Snowflake source.

## About the Design Files
The files in this bundle are **design references built in HTML**: prototypes that show the intended look and behavior. They are not production code to copy. Recreate the design in the target codebase's existing environment (React/Vue/etc.), using its patterns, component library and data layer. If there is no environment yet, use React + TypeScript.

- `Data Lineage v2.dc.html`: the reference prototype. Open it in a browser next to the `_ds/…` stylesheet path, or read the source. The template is the markup; the `class Component` block holds all logic and sample data.
- `lineage.sample.json`: the sample data model extracted from the prototype. Use it as a fixture and as the API contract starting point.
- `industry-styles.css`: the design-system tokens and classes ("Industry") used by the prototype.

## Fidelity
**High-fidelity.** Final layout, type, colors and interactions. Match them closely, using the codebase's equivalents of the Industry tokens.

---

## Data Model
```ts
type LayerId = 'ui' | 'bff' | 'data' | 'gql' | 'sf';
interface Layer { id: LayerId; label: string; sys: string }      // ordered UI → Snowflake
interface Node  { id: string; layer: LayerId; name: string; type: string; ctx: string }
// Edges point upstream → downstream (from = source side, to = consumer side)
interface Edge  { from: string; to: string; logic: string; broken?: string }
type Gaps = Record<string /*nodeId*/, string /*reason chain ends here*/>;
```
- `ctx` = where it lives: UI `Screen › Component`, BFF endpoint, Data API DTO class, GraphQL type, Snowflake `SCHEMA.TABLE`.
- `logic` starting with `"Direct"` = pass-through (shown as `=`); anything else = transform (shown as `ƒ`).
- `broken` = the mapping exists but is invalid (e.g. a renamed column). The text is the human-readable reason.
- A node can have several upstream edges (e.g. `Money.value ← TXN_AMT_MINOR + MINOR_UNITS`) and several downstream edges (fan-out).

In production, generate this from code and metadata: GraphQL schema and resolvers, Data API DTO mappers, BFF serializers, UI column definitions, and Snowflake `INFORMATION_SCHEMA`. Broken mappings = resolver references to columns missing from `INFORMATION_SCHEMA`.

### Derived values (per UI field = per row)
- `ids` = the UI node plus all ancestors (BFS on edges where `edge.to === id`).
- `deepest` = max layer index present (0–4). `missing = deepest < 4`.
- `edges` = edges with both ends in `ids`. `broken = edges.filter(e => e.broken)`.
- `status` = `'broken'` if any broken, else `'missing'` if missing, else `'ok'`.
- Coverage % = rows with status `ok` / total rows.
- Impact of a node = all descendants (BFS on `edge.from === id`) filtered to the `ui` layer.

---

## Screen: Lineage Matrix (single page)

### Layout
Page background `--color-bg` (#f2f2f3), text `--color-text` (#1d1f20). Horizontal padding 32px throughout.

1. **Top bar** (sticky, top 0, z 30, bg `--color-bg`, 1px bottom border `--color-divider`, padding 12px 32px). 3-column grid `auto | 1fr | auto`, gap 24px.
   - Left: logo mark (22×22 square, 1.5px accent border, 8×8 accent fill inside) + "Lineage" (Barlow Condensed 600, 20px) + "/" + "Transaction Research" (13px, neutral-700).
   - Center: search input (max-width 560, DS `.input`, 36px tall, Lucide `search` icon at 16px, stroke 1.5, left 12px). Placeholder: *"Filter by field or column name — e.g. amount, MERCHANT_NM"*.
   - Right: 6×6 accent square + "{n} attributes · {n} source columns" (12px, neutral-700).
2. **Intro row** (padding 28px 32px 18px; flex, space-between, wraps).
   - Left (max 640px): eyebrow "ATTRIBUTE LINEAGE MATRIX" (11px, letter-spacing .1em, uppercase, accent-700); H1 "Every screen field, traced to its Snowflake column" (Barlow Condensed 600, 38px, line-height 1.05); body copy (14px, neutral-700).
   - Right: filter controls (see Interactions): optional "Showing X of Y" + Clear ghost button; **Coverage {pct}%** label + segmented [All n | Fully traced n | Issues n]; **Screen** label + segmented [All | ResultsGrid | FilterBar | SelectionBar | RiskPanel | DisputePanel].
   - Segmented control: 1px divider border, square corners, items padding 7px 12px, 13px Barlow. Active = accent fill (#5980a6) + `--color-bg` text. Coverage items have a 7×7 square dot (accent for "Fully traced", red for "Issues").
3. **Main** (flex, wrap, gap 24px, padding 0 32px 48px).
   - Matrix: `flex: 999 1 720px; min-width: 0`.
   - Detail panel: `flex: 1 1 340px`, sticky top 77px, max-height `100vh - 100px`, scrolls internally. It wraps below the matrix on narrow viewports.

### Matrix
- Column grid (header and rows identical): `1fr 32px 1fr 32px 1fr 32px 1fr 32px 1fr`. Five layer columns with four 32px connector gutters.
- **Header row**: sticky below the top bar (top 61px), 1px top border `--color-text`, 1px bottom divider. Each layer header has padding 10px 12px, min-height 58, a 3px top bar in the layer color (inset box-shadow), a layer-tint background, index "01"–"05" (mono 10.5px, layer ink), label (Barlow Condensed 600 16px), and system name (11px, neutral-600).
  - Labels/systems: UI field / Transaction Research UI · BFF API / txn-research-bff · REST · Data API / txn-data-service · GraphQL / Snowflake GraphQL gateway · Snowflake / TXN_DB.
- **Row**: one per UI field. 1px bottom divider. Clickable (selects the row). Hover: accent at 6% mix. **Selected row**: bg `--color-accent-100` + inset 1px accent ring; cell tints are removed on the selected row. Rows impacted by the selected node get accent 5% bg.
- **Cell**: padding 12px, flex column, gap 6px, layer-tint background. It holds one or more **node chips**:
  - padding 5px 8px, 1px border (transparent by default; accent-400 + accent-100 bg when it matches search; accent + accent-200 bg when it is the selected node). Hover border is accent.
  - Line 1: 7×7 square in the layer color + name (12.5px, weight 500; Barlow for UI-layer names, monospace `ui-monospace, SF Mono, Menlo, Consolas` for all others).
  - Line 2 (toggle `showTypes`): type in mono 10.5px, neutral-700, indented 14px.
  - Clicking a chip (stopPropagation) selects that row and, for non-UI nodes, sets it as the "impact" node.
- **Missing cells** (layers deeper than `deepest`): amber tint bg, a dashed 1px amber box, min-height 34. The first missing cell is labelled "No source mapped".
- **Issue tag** in the UI cell of rows with status ≠ ok: 10px uppercase, letter-spacing .08em, padding 2px 6px, 1px border plus text in the status color with a tinted bg. Text: "Broken mapping" or "No source".
- **Connector gutter**: a horizontal 1px line through the vertical center, with an 18×18 square marker centered on it (1px border, bg `--color-bg`, mono 10px 600). The native `title` tooltip lists each edge's logic.
  - `ƒ` transform: accent line and border, accent-800 glyph.
  - `=` direct: divider line and border, neutral-600 glyph.
  - `!` broken: red line, border and glyph.
  - Gap (no upstream): dashed amber line, no marker.
- **Legend** under the matrix (12px, neutral-700, gap 20px): ƒ Transformed at this hop · = Passed through unchanged · ! Broken mapping · dashed line = No upstream source.
- Empty state: "No lineage matches “{q}”."

### Detail panel (DS `.blueprint` frame with 4 `+` corner marks)
1. **Header** (padding 18px 20px 16px, bottom divider): eyebrow = UI ctx (11px uppercase accent-700), title = UI field name (Barlow Condensed 600, 28px), tags (DS `.tag`, gap 4px inside): "{n} hops" (outline), "{n} transforms" (accent), "{n} source columns" (outline).
2. **Issues** (only if any): one card per issue. Padding 10px 12px, 1px border plus title in the status color, tinted bg. Title "BROKEN MAPPING" / "NO SNOWFLAKE SOURCE" (11px uppercase 600), location in mono 12px (`to ← from`, or "Chain ends at {layer} · {node}"), and the reason in 12.5px.
3. **Impact** (only when a non-UI node is selected; toggle `showImpact`): accent-100 bg. "IMPACT OF {LAYER} FIELD" + Clear ghost button, node name in mono 13px, "Feeds N UI field(s):", then a secondary button per UI field (click → select that row).
4. **Trail**: a vertical timeline, one step per layer from UI down to the deepest layer present. Left track is 14px wide: a 10×10 square in the layer color, then a 1px rail in the layer's light rail color (no rail after the last step). Step content: index (mono 10.5, layer ink) + layer label (Barlow Condensed 600 15px); each node as name (13px 500) and "{type} · {ctx}" (11.5px neutral-700); then the mappings into this layer, each with a label "`to  ←  from`" (11px neutral-600) and a code block (mono 11.5px, padding 5px 8px, `--color-surface` bg). Code color: neutral-700 for direct, accent-800 for transforms, red for broken (broken text is appended as `  ✕  reason`).

---

## Interactions & Behavior
| Action | Result |
|---|---|
| Type in search | Live filter. Rows stay if **any node name** in the chain matches (case-insensitive; `_` and `.` count as spaces). Matching chips are highlighted. Context and type text is NOT searched. |
| Coverage segment | All / Fully traced (`status==='ok'`) / Issues (`status!=='ok'`). |
| Screen segment | Filters rows whose UI `ctx` ends with the screen name. |
| Filters combine | They combine with AND. When any filter is active, "Showing X of Y" + Clear appear; Clear resets all three. |
| Click row | Selects the row (the detail panel updates) and clears the impact node. |
| Click non-UI chip | Selects its row and sets it as the impact node. All rows whose UI field descends from that node get a faint highlight, and the panel lists them. |
| Click impact chip | Switches the selected row and keeps the impact node. |
| Hover connector | Shows a tooltip with the mapping logic. |

Transitions: background and border-color over 120ms. No other animation.
Default state: row `u2` (Amount) selected, no filters.
Responsive: the panel wraps under the matrix below roughly 1100px of content width. Cells shrink (`minmax(0,1fr)`) and long names wrap (`overflow-wrap: anywhere`).

## State
```ts
{ q: string; row: string /*UI node id*/; node: string | null /*impact node*/;
  screen: 'All'|'ResultsGrid'|'FilterBar'|'SelectionBar'|'RiskPanel'|'DisputePanel';
  cov: 'all'|'ok'|'issues' }
```
Config toggles (were prototype tweaks; make them user settings or drop them): `layerColors` (default on; off = mono accent), `showTypes`, `showConnectors`, `showImpact`.
Data: one `GET /lineage` returning `{layers, nodes, edges, gaps}` (see JSON). Compute traversal client-side; the graph is small. Consider deep links: `?field=u2&node=s2`.

## Design Tokens (Industry DS — see industry-styles.css)
- Ground `--color-bg` #f2f2f3 · surface `--color-surface` #e9e9ea · text #1d1f20 · divider = text at 16% alpha.
- Accent #5980a6; ramp 100 #eef6ff, 200 #d6ebff, 300 #b5d9fd, 400 #94bce3, 600 #597ea3, 700 #416180, 800 #2c455d, 900 #1d2d3d.
- Neutral 600 #7a7a7d, 700 #5d5d60.
- **Layer colors** (an addition outside the mono DS; all share the same L/C): with H = UI 275, BFF 190, Data API 140, GraphQL 335, Snowflake 225 —
  - swatch `oklch(0.6 0.11 H)`
  - ink `oklch(0.42 0.09 H)`
  - tint `oklch(0.965 0.018 H)`
  - rail `oklch(0.85 0.05 H)`
- **Status**: broken `oklch(0.55 0.15 25)` / tint `oklch(0.96 0.025 25)`; missing `oklch(0.6 0.12 75)` / ink `oklch(0.45 0.1 75)` / tint `oklch(0.965 0.03 85)`.
- Type: Barlow Condensed 600 (headings), Barlow 400/500 (body), system monospace for technical identifiers. Base 15px.
- Shape: square corners everywhere (radius 0 on cards and chips). Hairline 1px borders. Panels use `.blueprint` corner marks.
- Icons: Lucide, stroke-width 1.5.

## Assets
No images. One Lucide icon (`search`). Fonts come from Google Fonts (Barlow, Barlow Condensed).

## Files
- `Data Lineage v2.dc.html`: reference prototype (template + logic + sample data).
- `lineage.sample.json`: 57 nodes, 47 edges, including one broken mapping (`SETTLE_DT → Transaction.settledAt`) and one missing source (`Transaction.disputeReason`).
- `industry-styles.css`: design-system tokens and classes.
