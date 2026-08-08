export class AllocationExceededError extends Error {
  constructor(
    public readonly _arg1?: string,
    public readonly _arg2?: string,
    public readonly _arg3?: string,
    public readonly customMessage?: string,
  ) {
    super(customMessage || _arg1 || 'Allocation exceeded');
    this.name = 'AllocationExceededError';
  }
}
