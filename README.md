# Data Lineage

Attribute lineage matrix for the **Transaction Research UI**. Every UI field is traced through four layers to its source:

`UI field → BFF API (REST) → Data API (GraphQL client) → GraphQL gateway → Snowflake column`

The page shows the transformation applied at each hop and flags broken mappings and fields with no Snowflake source. Select any upstream column to see which UI fields it impacts.

## Getting started

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit + component tests (Vitest)
npm run build      # typecheck + production build
```

## Data

The page loads one graph of `{ layers, nodes, edges, gaps }` (see `src/lib/types.ts`). Set `VITE_LINEAGE_URL` to the `GET /lineage` endpoint. Without it, the bundled fixture `src/fixtures/lineage.sample.json` is used. All traversal (ancestors, impact, coverage) is computed client-side in `src/lib/lineage.ts`.

In production, generate the graph from code and metadata: GraphQL schema and resolvers, Data API DTO mappers, BFF serializers, UI column definitions, and Snowflake `INFORMATION_SCHEMA`.

## Deep links

View state is kept in the query string: `?field=u12&node=s12&q=settle&screen=ResultsGrid&cov=issues`.

## Layout

- `src/lib/`: graph model and traversal, palette, URL state, data loading
- `src/components/`: `TopBar`, `Segmented`, `Matrix`, `DetailPanel`
- `src/styles/industry.css`: Industry design-system tokens; `src/styles/app.css`: page styles
- `docs/design/`: the original design handoff (prototype, spec, tokens, sample data)

Display options (`layerColors`, `showTypes`, `showConnectors`, `showImpact`) can be passed as `<App settings={…} />`; see `src/lib/settings.ts`.
