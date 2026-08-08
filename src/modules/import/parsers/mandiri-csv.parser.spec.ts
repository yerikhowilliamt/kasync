import { MandiriCsvParser } from './mandiri-csv.parser';
import { TransactionType } from '@prisma/client';

describe('MandiriCsvParser', () => {
  let parser: MandiriCsvParser;

  beforeEach(() => {
    parser = new MandiriCsvParser();
  });

  it('should parse valid Mandiri rows', async () => {
    // Date, Desc, Ref, Inflow, Outflow, Bal
    const csv = `15/01/2024,INFLOW TXN,REF123,1000.00,0.00,1000.00
16/01/2024,OUTFLOW TXN,REF456,0.00,500.00,500.00`;
    const buffer = Buffer.from(csv);

    const result = await parser.parse(buffer);

    expect(result.length).toBe(2);
    expect(result[0].amount).toBe('1000.00');
    expect(result[0].type).toBe(TransactionType.INFLOW);
    expect(result[0].externalRef).toBe('REF123');

    expect(result[1].amount).toBe('500.00');
    expect(result[1].type).toBe(TransactionType.OUTFLOW);
    expect(result[1].externalRef).toBe('REF456');
  });
});
