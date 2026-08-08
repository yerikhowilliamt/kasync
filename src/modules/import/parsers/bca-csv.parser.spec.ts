import { BcaCsvParser } from './bca-csv.parser';
import { TransactionType } from '@prisma/client';

describe('BcaCsvParser', () => {
  let parser: BcaCsvParser;

  beforeEach(() => {
    parser = new BcaCsvParser();
  });

  it('should parse valid BCA rows', async () => {
    const csv = `15/01/2024,TRANSFER IN,0000,1000.00,CR
16/01/2024,TRANSFER OUT,1234,500.50,DB`;
    const buffer = Buffer.from(csv);

    const result = await parser.parse(buffer);

    expect(result.length).toBe(2);
    expect(result[0].amount).toBe('1000.00');
    expect(result[0].type).toBe(TransactionType.INFLOW);
    expect(result[0].description).toBe('TRANSFER IN');
    expect(result[0].dedupHash).toBeDefined();

    expect(result[1].amount).toBe('500.50');
    expect(result[1].type).toBe(TransactionType.OUTFLOW);
    expect(result[1].description).toBe('TRANSFER OUT - 1234');
  });

  it('should skip malformed or empty rows', async () => {
    const csv = `invalid date row
,,
15/01/2024,Only,Two`;
    const buffer = Buffer.from(csv);
    const result = await parser.parse(buffer);
    expect(result.length).toBe(0);
  });
});
