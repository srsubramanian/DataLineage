import events from '../fixtures/lineage.openlineage.json';
import { fromOpenLineage } from '../lib/fromOpenLineage';
import { LAYERS } from '../lib/layers';
import type { RunEvent } from '../lib/openlineage';

export const sampleEvents = events as RunEvent[];
export const sampleData = fromOpenLineage(sampleEvents, LAYERS);

/** Node ids of the sample, by layer. */
export const ids = {
  amount: 'ui:TxnSearch.ResultsGrid#Amount',
  selectedTotal: 'ui:TxnSearch.SelectionBar#Selected total',
  settled: 'ui:TxnSearch.ResultsGrid#Settled',
  dispute: 'ui:TxnDetail.DisputePanel#Dispute reason',
  dataAmount: 'data:TransactionRecord#amount',
  gqlDispute: 'gql:Transaction#disputeReason',
  gqlSettled: 'gql:Transaction#settledAt',
  sf: (table: string, col: string) => `sf:TXN_DB.${table}#${col}`,
};
