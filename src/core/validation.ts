/** Shared validation usable by browser, API and CLI; never coerce invalid values. */
export function assertIdentifier(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) {
    throw new Error('Security Violation: invalid identifier');
  }
}
