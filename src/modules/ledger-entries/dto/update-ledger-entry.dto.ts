import { PartialType } from '@nestjs/swagger';
import { CreateLedgerEntryDto } from './create-ledger-entry.dto';

export class UpdateLedgerEntryDto extends PartialType(CreateLedgerEntryDto) {}
