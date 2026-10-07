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

## Data model: OpenLineage

Lineage is read as [OpenLineage](https://openlineage.io) `RunEvent`s (spec 2-0-2). Each hop in the stack is a job whose output dataset carries:

| Facet | Version | Used for |
|---|---|---|
| `schema` | [SchemaDatasetFacet 1-2-0](https://openlineage.io/docs/spec/facets/dataset-facets/schema) | The fields of a dataset and their types; these become the nodes |
| `columnLineage` | [ColumnLineageDatasetFacet 1-2-0](https://openlineage.io/docs/spec/facets/dataset-facets/column_lineage_facet) | Field → input fields, with `transformations` (`DIRECT`/`INDIRECT`, subtype, description, `masking`) |
| `datalineage_notes` | custom, [`schemas/LineageNotesDatasetFacet.json`](schemas/LineageNotesDatasetFacet.json) | Human notes on why a field's lineage is broken or ends early |

Each layer is identified by its dataset namespace (configured in `src/lib/layers.ts`):

| Layer | Namespace | Dataset name | Field |
|---|---|---|---|
| UI | `ui://txn-research-ui` | `Screen.Component` | UI field label |
| BFF API | `https://txn-research-bff` | endpoint, e.g. `GET /api/v1/transactions/search` | response property |
| Data API | `java://txn-data-service` | DTO class | property |
| GraphQL | `graphql://snowflake-gateway` | GraphQL type | type field |
| Snowflake | `snowflake://ACME-TXN_PROD` | `DATABASE.SCHEMA.TABLE` | column |

Datasets in other namespaces are ignored. Derived states:

- **Transformed (`ƒ`) vs. passed through (`=`)**: a hop is a pass-through only if every transformation is `DIRECT`/`IDENTITY`. Hops with no transformations reported count as transforms.
- **Broken mapping (`!`)**: an input field that is missing from its dataset's `schema` facet. For Snowflake, emit the schema facet from `INFORMATION_SCHEMA`, and any resolver still selecting a renamed or dropped column shows up as broken.
- **No source**: the field's chain never reaches the Snowflake namespace.

Set `VITE_LINEAGE_URL` to an endpoint returning the events as a JSON array or NDJSON. Without it, the sample `src/fixtures/lineage.openlineage.json` is used. Because the format is standard, the same events can be sent to any OpenLineage consumer, such as Marquez, DataHub, or Snowflake external lineage.

`npm test` validates the sample against the official JSON schemas vendored in `schemas/openlineage/`.

## Deep links

View state is kept in the query string: `field` and `node` take node ids of the form `{layer}:{dataset}#{field}`, e.g. `?field=ui:TxnSearch.ResultsGrid%23Settled`. Also `q`, `screen` and `cov`.

## Layout

- `src/lib/`: OpenLineage types and adapter (`openlineage.ts`, `fromOpenLineage.ts`), layer config, graph traversal, palette, URL state, data loading
- `schemas/`: vendored OpenLineage JSON schemas and the custom notes facet schema
- `src/components/`: `TopBar`, `Segmented`, `Matrix`, `DetailPanel`
- `src/styles/industry.css`: Industry design-system tokens; `src/styles/app.css`: page styles
- `docs/design/`: the original design handoff (prototype, spec, tokens, and the pre-OpenLineage sample data)

Display options (`layerColors`, `showTypes`, `showConnectors`, `showImpact`) can be passed as `<App settings={…} />`; see `src/lib/settings.ts`.
