import type { Layer } from './types';

/** The Transaction Research stack. Datasets whose namespace matches no layer are ignored. */
export const LAYERS: Layer[] = [
  {
    id: 'ui',
    label: 'UI field',
    sys: 'Transaction Research UI',
    namespace: 'ui://txn-research-ui',
    ctx: (dataset) => dataset.split('.').join(' › '),
  },
  { id: 'bff', label: 'BFF API', sys: 'txn-research-bff · REST', namespace: 'https://txn-research-bff' },
  { id: 'data', label: 'Data API', sys: 'txn-data-service', namespace: 'java://txn-data-service' },
  {
    id: 'gql',
    label: 'GraphQL',
    sys: 'Snowflake GraphQL gateway',
    namespace: 'graphql://snowflake-gateway',
    nodeName: (dataset, field) => `${dataset}.${field}`,
    ctx: (dataset) => `type ${dataset}`,
  },
  { id: 'sf', label: 'Snowflake', sys: 'TXN_DB', namespace: 'snowflake://ACME-TXN_PROD' },
];
