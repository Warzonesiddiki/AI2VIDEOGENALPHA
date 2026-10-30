import { DATA_NOTICE_VERSION } from '../../src/core/dataNotice.ts';

/** Browser settings are an allowlist, not a serialization of legacy storage. */
export function publicSettings(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid stored settings');
  const settings = input as Record<string, unknown>;
  const revision = settings.revision;
  if (!Number.isSafeInteger(revision) || (revision as number) < 0) throw new Error('Invalid stored settings revision');

  let productionTimezone: string | undefined;
  if (typeof settings.productionTimezone === 'string' && settings.productionTimezone.length <= 100) {
    try { new Intl.DateTimeFormat('en', { timeZone: settings.productionTimezone }); productionTimezone = settings.productionTimezone; }
    catch { /* Invalid stored text is not a verified timezone and is not exposed. */ }
  }
  const value = settings.budgetCaps;
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  let budgetCaps: { currency: 'USD'; perRunCapUsd?: number; perEpisodeCapUsd?: number; monthlyCapUsd?: number } | undefined;
  if (raw?.currency === 'USD') {
    budgetCaps = { currency: 'USD' };
    for (const key of ['perRunCapUsd', 'perEpisodeCapUsd', 'monthlyCapUsd'] as const) {
      const amount = raw[key];
      if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) budgetCaps[key] = amount;
    }
  }
  const dataNoticeAccepted = settings.dataNoticeAccepted === true;
  const acceptedDate = dataNoticeAccepted && typeof settings.noticeAcceptedDate === 'string' ? Date.parse(settings.noticeAcceptedDate) : NaN;
  return {
    revision: revision as number, productionTimezone, budgetCaps,
    dataNoticeVersion: DATA_NOTICE_VERSION, dataNoticeAccepted,
    noticeAcceptedDate: Number.isFinite(acceptedDate) ? new Date(acceptedDate).toISOString() : undefined,
  };
}
