import { DATA_NOTICE_VERSION } from '../../src/core/dataNotice.ts';
export interface DataNoticeEvent { version: string; accepted: boolean; recordedAt: string; settingsRevision: number; channel: 'operator-settings' }
/** Unsupported historic booleans/dates are not consent evidence. */
export function settingsView(settings: Record<string, unknown>, events: DataNoticeEvent[]) {
  const last = events.at(-1);
  const accepted = last?.version === DATA_NOTICE_VERSION && last.accepted === true && Number.isFinite(Date.parse(last.recordedAt));
  const providers = settings.providerConfigs;
  const providerConfigs = providers && typeof providers === 'object' && !Array.isArray(providers)
    ? Object.fromEntries(Object.entries(providers).map(([key, value]) => {
      const descriptor = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } as Record<string, unknown> : {};
      delete descriptor.checkedDate;
      return [key, { ...descriptor, verificationStatus: 'unverified' }];
    })) : {};
  return { ...settings, providerConfigs, revision: settings.revision ?? 0, dataNoticeVersion: DATA_NOTICE_VERSION,
    dataNoticeAccepted: !!accepted, noticeAcceptedDate: accepted ? last.recordedAt : undefined };
}
