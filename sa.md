# Handover: QBR Query Walkthrough and Reconcile page

You are picking up a small front-end project. Build it from scratch using this brief. A working prototype (`qbr-query-walkthrough-prototype.html`) is supplied next to this file as a reference for behaviour and data. Treat it as a sketch to learn from, not code to preserve.

## 1. What this is and who it is for

An engineering manager at a payments company prepares Quarterly Business Reviews (QBRs) for merchants. The numbers come from one long SQL query (Snowflake). Two problems:

1. **The query intimidates the team.** New people see 70 lines of CTEs and window functions and cannot tell what it does.
2. **Disputes are slow to settle.** After a report goes out, someone says "this approval rate is wrong". Today, finding the cause means reading the whole query.

The page solves both with one idea: **the query is a stack of small steps, and each step can be run and checked on its own.**

- **Learn mode** tells the query as a story. One idea per step, with the SQL growing alongside, so the reader watches the full query assemble and never meets it all at once.
- **Reconcile mode** reuses the same steps as checkpoints. The user runs a small totals query per step and the page points to the first step where the numbers stop adding up.

Readers are engineers and analysts on the team. Some know SQL well, some barely. Write all page copy in plain language.

## 2. Hard constraints

- **One self-contained HTML file.** No build step, no Node or Python packages, no framework. It must open from disk by double-click and also work when hosted as a static page.
- **Animation uses Motion (https://motion.dev)**, loaded as a plain script. The owner asked for Motion specifically.
- **The page never connects to a database.** Reconcile mode is copy and paste: the page composes SQL, the user runs it in Snowflake, and pastes totals back. A live connection may come later; do not build it now.
- **The page must work with Motion missing** (blocked CDN, offline). Animations are an enhancement. Never leave content at `opacity: 0` waiting for a script.
- Respect `prefers-reduced-motion`.
- Light and dark themes, driven by CSS custom properties.
- Works at phone width (about 400px) with no horizontal page scroll. Code blocks and tables scroll inside their own containers.

### Loading Motion

```html
<!-- Pin an exact version. The prototype used 11.11.13. -->
<script src="https://cdn.jsdelivr.net/npm/motion@11.11.13/dist/motion.js"></script>
<script>
  const M = window.Motion || {};            // global is `Motion`
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches || !M.animate;
  // usage: if (!calm) M.animate(el, { opacity: [0, 1], x: [-16, 0] }, { duration: .35, delay: M.stagger(.045) });
</script>
```

Before relying on this, confirm the version exists and that the UMD file exposes `animate`, `stagger`, `inView` and `scroll` on `window.Motion`. The team works in a regulated environment where CDNs may be blocked, so also support a vendored copy: if `./vendor/motion.js` is present, load that instead. Ask the owner which they prefer.

## 3. Ask the owner before you start

1. **The real query.** Everything in the prototype is invented: table names (`payments.authorizations`, `payments.settlements`, `payments.chargebacks`), columns, and all result numbers. Ask for the real SQL. If it is not available yet, build against the sample in section 6 and keep it swappable.
2. **Definitions.** Which response codes count as approved? Are retries counted as separate attempts? Which time zone sets the quarter boundary? Is a chargeback counted in the quarter of the sale or the quarter it was received? (The sample uses the sale's settlement quarter, which is a simplification.)
3. **CDN or vendored Motion.**
4. **Where the file will live** (a shared drive, an internal static host, a repo).

## 4. Architecture: one config, two modes

Put all report-specific content in a single `REPORT` object at the top of the script. Rendering code below it must not mention approval rates or chargebacks. A new report should mean a new config, not a new page.

```js
const REPORT = {
  title: "How the merchant QBR query is built",
  file: "qbr_metrics.sql",

  // The query as an ordered list of lines. Each line knows which step introduces it
  // and (optionally) which step removes it. This is what makes the SQL "grow".
  lines: [
    { t: "SELECT merchant_id, auth_id, auth_ts, amount, response_code", from: 0, until: 1 },
    { t: "WITH auths AS (",                                 from: 1 },
    { t: "    merchant_id,",                                from: 1, quiet: true }, // re-indented, do not flag as new
    { t: "    DATE_TRUNC('quarter', auth_ts) AS qtr,",      from: 1 },
    // ...
  ],

  // Learn mode: one entry per step.
  steps: [
    {
      name: "Raw rows",                       // short chip label
      title: "Start with one table",
      body: "Every card swipe or checkout click lands as one row ...",
      changes: ["<code>:merchant_id</code> is a bind variable ..."],   // "what changed in the SQL"
      pitfall: "Optional: what goes wrong without this step.",
      result: { cols: [...], rows: [[...]], hot: [1], note: "One row per authorization attempt." }
    },
    // ...
  ],

  // The building blocks diagram: which named blocks exist at which step.
  flow: [
    [{ n: "authorizations", from: 0 }, { n: "auths", from: 1 }, { n: "auth_metrics", from: 2 }],
    [{ n: "settlements + chargebacks", from: 4 }, { n: "disputes", from: 4 }],
    [{ n: "QBR result", from: 5 }]
  ],

  // Reconcile mode: see section 7.
  scope: [...], checkpoints: [...], metrics: [...], switches: [...]
};
```

Core helpers (taken from the prototype, converted to the object form):

```js
// Lines visible at step s.
const linesAt = s => REPORT.lines.filter(l => l.from <= s && (l.until === undefined || s < l.until));
// A line is highlighted as new when it is introduced at this step and not marked quiet.
const isNew = (l, s) => l.from === s && !l.quiet && s > 0;
// The CTE prefix at step s: everything before the first top-level SELECT.
const cteAt = s => { const t = linesAt(s).map(l => l.t); return t.slice(0, t.findIndex(x => /^SELECT/.test(x))); };
```

Why lines carry `from`/`until` instead of storing seven full snapshots: the highlight and the animation fall out for free, a line edited in one place stays consistent across steps, and reconcile mode can compose its queries from the same source (`cteAt`). The cost is care with closers: a CTE's `)` becomes `),` when the next CTE arrives, so model those as two lines (`{t: ")", from: 1, until: 2}` and `{t: "),", from: 2, quiet: true}`).

## 5. Learn mode

### Layout

- Header: title, two-sentence explanation, and a visible label that the data is illustrative (until real data is wired in).
- Mode switch: "Learn the query" / "Reconcile a number". Support the URL hash `#reconcile` to open the second mode directly.
- Step chips: numbered, clickable, showing done / current / upcoming.
- Two columns. Left is the story. Right is the SQL panel, sticky while the left column scrolls. Stacks to one column under about 860px.

Left column, top to bottom:
1. "Step 3 of 7", the step title, one short paragraph.
2. "What changed in the SQL": two or three bullets.
3. "What exists so far": the block diagram from `REPORT.flow`. Blocks not yet built are dashed and dim; blocks added in this step are highlighted.
4. "What this step returns": a small result table, with the columns that are new in this step tinted.
5. A one-line note under the table.
6. Back / Next buttons. Left and right arrow keys also move, except when focus is in an input.

Right column: file name bar with a "Copy this step" button, the code with line numbers, and a legend ("Added in this step").

### Behaviour

- Every step is a complete, runnable query. Steps that build a CTE end with `SELECT * FROM <that cte>` so the reader can run it and see the block.
- On step change, scroll the code panel so the first new line is in view.
- Animation on step change (skip all of it when `calm`):
  - story block: fade and 10px slide, direction depends on forward or back
  - new SQL lines: fade and slide in from the left, staggered about 45ms
  - result rows: staggered fade
  - newly built flow blocks: a small scale pop
- First paint renders step 1 with no animation.

### SQL highlighting

A single regex pass is enough. Escape HTML as you go.

```js
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const RX = /(--.*$)|('[^']*')|\b(SELECT|FROM|WHERE|WITH|AS|AND|ON|LEFT|JOIN|GROUP|BY|ORDER|OVER|PARTITION|DISTINCT)\b|\b(DATE_TRUNC|DATEADD|COUNT_IF|COUNT|SUM|IFF|NULLIF|LAG|CURRENT_DATE)\b/g;
function paint(t) {
  let out = "", i = 0, m; RX.lastIndex = 0;
  while ((m = RX.exec(t))) {
    out += esc(t.slice(i, m.index));
    const cls = m[1] ? "cm" : m[2] ? "st" : m[3] ? "kw" : "fn";
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    i = m.index + m[0].length;
  }
  return out + esc(t.slice(i));
}
```

Extend the keyword and function lists to cover whatever the real query uses (`QUALIFY`, `CASE`, `COALESCE`, and so on).

### Copy button

Clipboard access can be refused in some hosts. Always fall back to selecting the text.

```js
function copyText(text, btn, node) {
  const fallback = () => {
    const r = document.createRange(); r.selectNodeContents(node);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    btn.textContent = "Selected, press copy";
  };
  try { navigator.clipboard.writeText(text).then(() => { btn.textContent = "Copied"; }, fallback); }
  catch (_) { fallback(); }
}
```

## 6. The sample story (use until the real query arrives)

Seven steps. The final query at step 7:

```sql
WITH auths AS (
  SELECT
    merchant_id,
    DATE_TRUNC('quarter', auth_ts) AS qtr,
    card_brand,
    channel,                 -- 'CP' or 'CNP'
    amount,
    response_code
  FROM payments.authorizations
  WHERE merchant_id = :merchant_id
    AND auth_ts >= DATEADD('quarter', -2, DATE_TRUNC('quarter', CURRENT_DATE))
    AND auth_ts <  DATE_TRUNC('quarter', CURRENT_DATE)
),
auth_metrics AS (
  SELECT
    merchant_id,
    qtr,
    card_brand,
    channel,
    COUNT(*) AS attempts,
    COUNT_IF(response_code = '00') AS approvals,
    SUM(IFF(response_code = '00', amount, 0)) AS approved_volume,
    approvals / NULLIF(attempts, 0) AS approval_rate
  FROM auths
  GROUP BY merchant_id, qtr, card_brand, channel
),
disputes AS (
  SELECT
    s.merchant_id,
    DATE_TRUNC('quarter', s.settled_ts) AS qtr,
    s.card_brand,
    s.channel,
    COUNT(DISTINCT s.txn_id) AS settled_txns,
    COUNT(DISTINCT c.chargeback_id) AS chargebacks,
    chargebacks / NULLIF(settled_txns, 0) AS chargeback_rate
  FROM payments.settlements s
  LEFT JOIN payments.chargebacks c
    ON c.txn_id = s.txn_id
  WHERE s.merchant_id = :merchant_id
    AND s.settled_ts >= DATEADD('quarter', -2, DATE_TRUNC('quarter', CURRENT_DATE))
    AND s.settled_ts <  DATE_TRUNC('quarter', CURRENT_DATE)
  GROUP BY 1, 2, 3, 4
)
SELECT
  a.qtr,
  a.card_brand,
  a.channel,
  a.attempts,
  a.approval_rate,
  a.approval_rate - LAG(a.approval_rate) OVER (
    PARTITION BY a.card_brand, a.channel ORDER BY a.qtr
  ) AS approval_rate_qoq,
  d.chargeback_rate
FROM auth_metrics a
LEFT JOIN disputes d
  ON  d.merchant_id = a.merchant_id
  AND d.qtr         = a.qtr
  AND d.card_brand  = a.card_brand
  AND d.channel     = a.channel
ORDER BY a.qtr, a.card_brand, a.channel
```

| # | Chip | Idea introduced | SQL added |
|---|---|---|---|
| 1 | Raw rows | One row per authorization attempt | Plain `SELECT ... WHERE merchant_id = :merchant_id` |
| 2 | Quarters | Label each row with its quarter; keep the last two complete quarters; name the result | `DATE_TRUNC`, the two date filters, `WITH auths AS (...)` |
| 3 | Approval rate | Collapse rows: attempts, approvals, rate | `auth_metrics` CTE, grouped by merchant and quarter |
| 4 | Brand & channel | Same maths at a finer grain | `card_brand`, `channel` added to `auths` and to the `GROUP BY` |
| 5 | Chargebacks | A second block with the same grain, from different tables | `disputes` CTE |
| 6 | Join | Line the two blocks up | Final `SELECT` with the four-column `LEFT JOIN` |
| 7 | Quarter over quarter | Compare with the previous quarter | `LAG ... OVER (PARTITION BY ...)`, `ORDER BY` |

The narrative copy, "what changed" bullets, and result tables for all seven steps are in the prototype's `S` array. Reuse them. The sample numbers are internally consistent and should stay that way: the four brand/channel rows in step 4 sum to the Q3 row in step 3 (438,115 attempts, 400,875 approvals, 91.5%).

## 7. Reconcile mode

### Flow

1. **State the dispute.** Metric (approval rate or chargeback rate), reported value, expected value.
2. **Narrow the scope.** Quarter start date, card brand, channel. These become `WHERE` conditions in every checkpoint query.
3. **Work down the checkpoints.** Each card shows: a title, one sentence on what it proves, the composed SQL with a copy button, one input per returned column, a status pill (Waiting / Adds up / Mismatch), and a message.
4. **Read the verdict line.** It names the first mismatching checkpoint, or says whether the pasted totals reproduce the reported value or the expected value.

### Rules

- Changing the scope rewrites every query **and clears pasted totals**, so stale numbers are never compared against new queries. Say this on the page.
- Pasting a whole result row (tab or space separated) into the first input fills the rest of that checkpoint.
- Strip thousands separators and `%`/`$` when reading numbers. An empty input is "waiting", never zero.
- Scope values are inserted into SQL text the user will run. Only accept values from fixed dropdowns or a validated date (`/^\d{4}-\d{2}-\d{2}$/`). No free-text scope fields.
- Persist the form as a draft in `localStorage` inside try/catch. The page must work if storage is unavailable.

### Sample checkpoints

| # | Checkpoint | Returns | Passes when | If it fails, the cause is usually |
|---|---|---|---|---|
| 1 | Raw authorizations | `row_count`, `distinct_auths` | equal | duplicate rows in the source |
| 2 | After the quarter filter | `row_count` | equals #1 `row_count` | quarter boundary or time zone |
| 3 | Attempts and approvals | `attempts`, `approvals` | `attempts` equals #2; approvals <= attempts | rows gained or lost in grouping |
| 4 | Settled sales and chargebacks | `settled_txns`, `chargebacks` | chargebacks <= settled | wrong denominator or dating |
| 5 | Join fan-out | `segments_before`, `rows_after_join` | equal | `disputes` has more than one row per segment |

Checkpoint 3 yields the computed approval rate, checkpoint 4 the computed chargeback rate.

### Composing checkpoint queries

Build them from the same lines as learn mode so the two can never drift apart.

```js
// Scope conditions. p = column prefix ("" or "a."), raw = querying the source table before `qtr` exists.
function conds(p, raw) {
  const c = [], q = $("f-qtr").value, b = $("f-brand").value, ch = $("f-chan").value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) c.push(raw ? `DATE_TRUNC('quarter', auth_ts) = '${q}'` : `${p}qtr = '${q}'`);
  if (b)  c.push(`${p}card_brand = '${b}'`);
  if (ch) c.push(`${p}channel = '${ch}'`);
  return c;
}
const W = (p, inline) => { const c = conds(p); return c.length ? (inline ? " WHERE " : "\nWHERE ") + c.join(inline ? " AND " : "\n  AND ") : ""; };

const checkpoints = [
  { id: "metrics", title: "Attempts and approvals", fields: ["attempts", "approvals"],
    why: "Adds up the grouped block. Attempts should equal the auths row count.",
    sql: () => cteAt(3).join("\n") +
      "\nSELECT\n  SUM(attempts) AS attempts,\n  SUM(approvals) AS approvals\nFROM auth_metrics" + W("") },
  { id: "join", title: "Join fan-out", fields: ["segments_before", "rows_after_join"],
    why: "Checks that joining the two blocks does not multiply rows.",
    sql: () => cteAt(6).join("\n") +
      `\nSELECT\n  (SELECT COUNT(*) FROM auth_metrics a${W("a.", true)}) AS segments_before,\n  COUNT(*) AS rows_after_join\n` +
      JOIN_LINES.join("\n") + W("a.") },
  // ...
];
```

In the config-driven version, express each checkpoint's pass rule as data or a small function on the checkpoint itself (`check(values, earlier) => {state, msg}`), so `judge()` is a generic loop.

### Verdict logic

```js
// comp = rate computed from pasted totals; rep / exp = reported and expected (may be NaN)
// tol = 0.05 points for approval rate, 0.005 for chargeback rate
if (firstBad >= 0)        -> "The numbers first part ways at checkpoint N (title). Start there."          [bad]
else if (isNaN(comp))     -> "Run each query in Snowflake and paste its totals back ..."                  [neutral]
else if (matches rep only)-> "reproduces the reported value. The calculation holds for this scope, so the
                              expected value is probably using a different definition or scope."         [ok]
else if (matches exp only)-> "matches the expected value and not the report. Check how the report
                              filtered or rounded this number."                                          [bad]
else if (matches neither) -> "matches neither value. Check that the scope is the one the report used."   [bad]
```

State is shown with a pill and a coloured message, never colour alone. Animate the pill with a small scale pop when its state changes.

## 8. Build order

### Phase 1: rebuild what the prototype does
Learn mode and reconcile mode as described above, on the config-driven structure from section 4.

### Phase 2: the three improvements the owner should get next

**A. Swap in the real query.** Split it into steps with the owner. Each step must introduce one idea and be runnable. Rebuild the checkpoints around the real steps.

**B. Definition switches (reconcile mode).** Most disputes are two people using different definitions. Add toggles that rewrite the composed SQL, so the user can find which definition reproduces the challenger's number. Model each as a text transform on specific lines:

```js
switches: [
  { id: "approved", label: "Which codes count as approved",
    options: [
      { label: "00 only",                          expr: "response_code = '00'" },
      { label: "00, 10 (partial), 85 (no reason to decline)", expr: "response_code IN ('00','10','85')" }
    ] },   // replaces the predicate inside COUNT_IF / IFF
  { id: "tz", label: "Quarter boundary time zone",
    options: [
      { label: "As stored",     expr: "auth_ts" },
      { label: "US Eastern",    expr: "CONVERT_TIMEZONE('UTC', 'America/New_York', auth_ts)" }
    ] },   // replaces the timestamp expression inside DATE_TRUNC and the range filters
  { id: "retries", label: "Retries",
    options: [
      { label: "Every attempt counts", clause: "" },
      { label: "One per order",        clause: "QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY auth_ts DESC) = 1" }
    ] }    // appended to the auths CTE; `order_id` is a placeholder column, confirm the real one
]
```

Implement switches as placeholders in line text (for example `{{approved}}`, `{{ts}}`) resolved at render time, not as string replacement on finished SQL. Changing a switch clears pasted totals, same as changing scope. Show the active definitions in the verdict line.

**C. Finding summary.** A "Copy summary" button that produces plain text someone can paste into a ticket or email:

```
QBR reconciliation: Approval rate, Visa CNP, quarter starting 2026-07-01
Reported 88.0% | Expected 89.2% | Recomputed 88.00%
Definitions: approved = 00 only; time zone as stored; every attempt counts
1 Raw authorizations        row_count 110,000 | distinct_auths 110,000   adds up
2 After the quarter filter  row_count 110,000                            adds up
3 Attempts and approvals    attempts 110,000 | approvals 96,800          adds up
Conclusion: totals reproduce the reported value. Switching Retries to "One per order" gives 89.2%.
```

### Phase 3: later options, in rough priority order

- **Automatic drill-down.** When a checkpoint mismatches, offer the next narrower query: the same totals by month, then by day, then the transaction list for the day that differs. Example: `SELECT DATE_TRUNC('day', auth_ts) AS d, COUNT(*) ... GROUP BY 1 ORDER BY 1`.
- **Two columns of totals.** Let the challenger enter their own figure at each checkpoint so the comparison happens per step.
- **Follow one transaction (learn mode).** Pick one sample authorization and show where it lands at every step.
- **Animate the GROUP BY collapse (learn mode).** Sample rows visibly merge into one summary row. This is the best use of Motion on the page.
- **Glossary hovers** for CP/CNP, response codes, `LAG`, and similar.
- **Paste a query, draft the steps.** Split a pasted query into its CTEs and generate a starter config.
- **Replace copy and paste** with a browser-side extract or a live read-only connection.

## 9. Visual direction

Utilitarian documentation, not a marketing page. Calm, technical, easy to read for long stretches.

- Cool neutral background, white (or dark slate) surfaces, deep teal accent for structure, amber reserved for "new in this step". Green and red are used only for pass/fail and are separate from the accent.
- Type: a grotesque for headings, a plain sans for body, a monospace for code and for column-name labels. Body text near 60 to 65 characters wide. Tabular numerals in tables.
- All colours as CSS custom properties on `:root`, redefined for dark under both `@media (prefers-color-scheme: dark)` and an explicit `[data-theme="dark"]`.
- Avoid: centered hero sections, gradient backgrounds, emoji as markers, identical rounded cards for everything.

Prototype tokens, as a starting point:

```css
:root {
  --bg:#f2f5f7; --surface:#ffffff; --ink:#14212b; --muted:#566773; --line:#d3dce3;
  --accent:#0a6c6c; --accent-ink:#ffffff; --new:#fff0bf; --mark:#a86400;
  --str:#9a3d6b; --fn:#3b55b5; --ok:#1f7a3d; --bad:#b3261e;
}
/* dark */
--bg:#0e161c; --surface:#162129; --ink:#e3ebf0; --muted:#94a5b1; --line:#2a3943;
--accent:#52c4be; --accent-ink:#06211f; --new:#3b3210; --mark:#f0b84a;
--str:#f09bc0; --fn:#9db2ff; --ok:#6fd08c; --bad:#ff8a80;
```

## 10. Acceptance checks

Open the file in a browser and confirm each of these. The prototype was published without being opened in a browser, so do not assume any of it works.

Learn mode
- [ ] Step 1 is fully visible on load with no interaction.
- [ ] Next, Back, chips and arrow keys all move between steps. Arrow keys do nothing while typing in an input.
- [ ] At every step the SQL shown is syntactically complete (balanced parentheses, correct commas between CTEs). Copy each step's SQL and check.
- [ ] Only lines introduced in the current step are highlighted. Re-indented lines are not.
- [ ] The code panel scrolls to the first new line.
- [ ] With Motion blocked (rename the script URL), everything still renders and works.
- [ ] With reduced motion enabled, nothing animates.

Reconcile mode
- [ ] Each checkpoint query is syntactically complete for every combination of scope filters, including none.
- [ ] Changing scope rewrites the queries and clears totals.
- [ ] Pasting `110,000<TAB>96,800` into the first box of checkpoint 3 fills both boxes.
- [ ] Entering mismatched values in checkpoint 2 makes the verdict name checkpoint 2.
- [ ] Matching totals with reported 88.0 and expected 89.2 give the "reproduces the reported value" verdict.
- [ ] Reloading the page restores the draft. Private browsing does not break the page.

Both
- [ ] Light and dark themes are both legible.
- [ ] No horizontal page scroll at 400px wide.
- [ ] Keyboard focus is visible on every control.

## 11. Known gaps in the prototype

- Never opened in a browser. Layout, animation and the Motion global are unverified.
- It was written for a hosting wrapper that supplies the page skeleton; the supplied copy has a minimal `<!doctype html>` head added so it opens from disk.
- All SQL, table names and numbers are invented.
- Checkpoint pass rules are hard-coded in one `judge()` function instead of living on each checkpoint.
- Chargebacks are dated by the sale's settlement quarter. Card network monitoring programs use other conventions; confirm with the owner.
- No definition switches, drill-down, or summary export yet.
