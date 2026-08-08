export class AllocationExceededError extends Error {
  constructor(
    public readonly txnId?: string,
    public readonly attempted?: string,
    public readonly max?: string,
    message?: string,
  ) {
    super(
      message ||
        `Allocation total (${attempted || 'unknown'}) would exceed bank transaction amount (${max || 'unknown'}) for transaction ${txnId || 'unknown'}`,
    );
    this.name = 'AllocationExceededError';
  }
}
