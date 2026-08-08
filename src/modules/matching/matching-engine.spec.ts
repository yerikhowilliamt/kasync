import { Decimal } from 'decimal.js';
import {
  MatchingEngine,
  BankTransactionInput,
  LedgerEntryInput,
  MatchType,
} from './matching-engine';

describe('MatchingEngine', () => {
  let engine: MatchingEngine;

  beforeEach(() => {
    engine = new MatchingEngine();
  });

  const createTxn = (
    id: string,
    amountStr: string,
    type: 'INFLOW' | 'OUTFLOW',
    daysOffset: number = 0,
  ): BankTransactionInput => {
    const d = new Date('2023-10-15T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + daysOffset);
    return {
      id,
      amount: new Decimal(amountStr),
      type,
      txnDate: d,
    };
  };

  const createEntry = (
    id: string,
    amountStr: string,
    type: 'INFLOW' | 'OUTFLOW',
    daysOffset: number = 0,
  ): LedgerEntryInput => {
    const d = new Date('2023-10-15T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + daysOffset);
    return {
      id,
      amount: new Decimal(amountStr),
      type,
      entryDate: d,
    };
  };

  it('finds EXACT match', () => {
    const txn = createTxn('T1', '100.50', 'INFLOW');
    const entry = createEntry('L1', '100.50', 'INFLOW');

    const res = engine.proposeMatches([txn], [entry]);

    expect(res).toHaveLength(1);
    expect(res[0].matchType).toBe(MatchType.EXACT);
    expect(res[0].confidence).toBe(1.0);
    expect(res[0].bankTransactionIds).toEqual(['T1']);
    expect(res[0].ledgerEntryId).toBe('L1');
  });

  it('finds FUZZY match within tolerance', () => {
    // Txn is 2 days after ledger entry
    const txn = createTxn('T1', '200.00', 'OUTFLOW', 2);
    const entry = createEntry('L1', '200.00', 'OUTFLOW');

    const res = engine.proposeMatches([txn], [entry]);

    expect(res).toHaveLength(1);
    expect(res[0].matchType).toBe(MatchType.FUZZY);
    expect(res[0].confidence).toBe(0.8); // 1.0 - 0.1 * 2
    expect(res[0].dateDifferenceDays).toBe(2);
  });

  it('ignores FUZZY match outside tolerance', () => {
    // Txn is 4 days after ledger entry, tolerance is 3
    const txn = createTxn('T1', '200.00', 'OUTFLOW', 4);
    const entry = createEntry('L1', '200.00', 'OUTFLOW');

    const res = engine.proposeMatches([txn], [entry]);

    expect(res).toHaveLength(0);
  });

  it('finds AGGREGATION match (2 txns)', () => {
    const t1 = createTxn('T1', '50.00', 'INFLOW', 1);
    const t2 = createTxn('T2', '75.50', 'INFLOW', 2);
    const entry = createEntry('L1', '125.50', 'INFLOW');

    const res = engine.proposeMatches([t1, t2], [entry]);

    expect(res).toHaveLength(1);
    expect(res[0].matchType).toBe(MatchType.AGGREGATION);
    expect(res[0].bankTransactionIds).toContain('T1');
    expect(res[0].bankTransactionIds).toContain('T2');
    expect(res[0].confidence).toBe(0.75); // 0.85 - (0.05 * 2 maxDiff)
  });

  it('ignores AGGREGATION match if subset exceeds max', () => {
    const t1 = createTxn('T1', '10', 'INFLOW');
    const t2 = createTxn('T2', '10', 'INFLOW');
    const t3 = createTxn('T3', '10', 'INFLOW');
    const t4 = createTxn('T4', '10', 'INFLOW');
    const t5 = createTxn('T5', '10', 'INFLOW');
    const entry = createEntry('L1', '50', 'INFLOW');

    const res = engine.proposeMatches([t1, t2, t3, t4, t5], [entry], {
      maxAggregationSubsetSize: 4,
    });

    expect(res).toHaveLength(0);
  });

  it('no match for different types or amounts', () => {
    const t1 = createTxn('T1', '100', 'INFLOW');
    const entry = createEntry('L1', '100', 'OUTFLOW'); // Diff type
    const entry2 = createEntry('L2', '99', 'INFLOW'); // Diff amount

    const res = engine.proposeMatches([t1], [entry, entry2]);

    expect(res).toHaveLength(0);
  });

  it('prioritizes exact matches and ranks candidates correctly', () => {
    const tExact = createTxn('T1', '100', 'INFLOW', 0);
    const lExact = createEntry('L1', '100', 'INFLOW', 0);

    const tFuzzy = createTxn('T2', '200', 'INFLOW', 1);
    const lFuzzy = createEntry('L2', '200', 'INFLOW', 0);

    const res = engine.proposeMatches([tExact, tFuzzy], [lExact, lFuzzy]);

    expect(res).toHaveLength(2);
    expect(res[0].matchType).toBe(MatchType.EXACT); // 1.0 confidence
    expect(res[1].matchType).toBe(MatchType.FUZZY); // 0.9 confidence
    expect(res[1].ledgerEntryId).toBe('L2');
  });
});
