import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DocumentStore } from './documents.ts';
import { safePath, assertIdentifier } from './paths.ts';
import type { SpendApprovalGrant } from '../../src/types/index.ts';
import type { BudgetCaps } from '../../src/core/budget.ts';

export type ReservationState = 'reserved' | 'dispatched' | 'unknown' | 'committed' | 'released';
export interface ReserveSpend {
  projectId: string; episodeId: string; runId: string; provider: string;
  approvalId: string; idempotencyKey: string; maxCostUsd: number;
}
export interface SpendReservation extends ReserveSpend {
  reservationId: string; state: ReservationState; reservedMicros: number;
  chargedMicros: number; createdAt: string; updatedAt: string; chargedAt?: string;
  evidence?: string;
}
export interface SpendEvent {
  reservationId: string; state: ReservationState; timestamp: string; evidence?: string;
}
interface LedgerData { reservations: SpendReservation[]; events: SpendEvent[] }

function micros(value: number): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 1_000_000))) throw new Error('Invalid USD amount');
  const amount = Math.round(value * 1_000_000);
  if (Math.abs(amount / 1_000_000 - value) > 1e-10) throw new Error('USD amount has more than six decimal places');
  return amount;
}
function sum(values: number[]): number {
  const result = values.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(result)) throw new Error('Spend total overflow');
  return result;
}

/** No grant creation here. Only existing persisted approvals may be consumed.
 * This service has no network capability and remains disconnected from paid execution.
 */
export class SpendLedger {
  private file: string;
  constructor(private root: string, private store: DocumentStore) {
    this.file = path.join(root, 'spend_ledger.json');
  }
  private grantsFile(project: string) { return path.join(this.root, 'projects', project, 'spend_grants.json'); }
  private data() { return this.store.read<LedgerData>(this.file, { reservations: [], events: [] }); }
  list(projectId: string): SpendReservation[] {
    assertIdentifier(projectId);
    return this.data().reservations.filter(row => row.projectId === projectId);
  }
  events(projectId: string): SpendEvent[] {
    const ids = new Set(this.list(projectId).map(row => row.reservationId));
    return this.data().events.filter(row => ids.has(row.reservationId));
  }
  /** Shared reservation/dispatch policy. Holds already in the ledger are counted once.
   * Run/episode caps are project-scoped; monthly cap covers this whole root in UTC.
   */
  private assertCurrentCaps(ledger: LedgerData, request: ReserveSpend, additionalMicros: number) {
    const settings = this.store.read<{ budgetCaps?: BudgetCaps }>(path.join(this.root, 'settings.json'), {});
    const caps = settings.budgetCaps;
    if (!caps || caps.currency !== 'USD') throw new Error('Valid persisted USD budget caps are required');
    const runCap = micros(caps.perRunCapUsd), episodeCap = micros(caps.perEpisodeCapUsd), monthCap = micros(caps.monthlyCapUsd);
    const held = ledger.reservations.filter(row => ['reserved', 'dispatched', 'unknown'].includes(row.state));
    const committed = ledger.reservations.filter(row => row.state === 'committed');
    const histories = new Map<string, number>();
    for (const entry of fs.readdirSync(safePath(this.root, 'projects'), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      assertIdentifier(entry.name);
      const grants = this.store.read<SpendApprovalGrant[]>(safePath(this.root, this.grantsFile(entry.name)), []);
      histories.set(entry.name, sum(grants.map(grant => {
        const accounted = sum(committed.filter(row => row.projectId === entry.name && row.approvalId === grant.approvalId).map(row => row.chargedMicros));
        return Math.max(0, micros(grant.actualSpentUsd) - accounted);
      })));
    }
    const history = histories.get(request.projectId) ?? 0;
    const project = [...held, ...committed].filter(row => row.projectId === request.projectId);
    const exposure = (rows: SpendReservation[]) => sum(rows.map(row => row.state === 'committed' ? row.chargedMicros : row.reservedMicros));
    const month = new Date().toISOString().slice(0, 7);
    if (sum([history, exposure(project.filter(row => row.runId === request.runId)), additionalMicros]) > runCap) throw new Error('Per-run budget cap exceeded');
    if (sum([history, exposure(project.filter(row => row.episodeId === request.episodeId)), additionalMicros]) > episodeCap) throw new Error('Per-episode budget cap exceeded');
    if (sum([sum([...histories.values()]), exposure([...held, ...committed.filter(row => row.chargedAt?.slice(0, 7) === month)]), additionalMicros]) > monthCap) throw new Error('Monthly budget cap exceeded');
  }
  reserve(request: ReserveSpend): SpendReservation {
    for (const value of [request.projectId, request.episodeId, request.runId, request.provider, request.approvalId, request.idempotencyKey]) assertIdentifier(value);
    const amount = micros(request.maxCostUsd);
    if (amount <= 0) throw new Error('A positive spending ceiling is required');
    return this.store.transaction(() => {
      const ledger = this.data();
      const existing = ledger.reservations.find(row => row.projectId === request.projectId && row.idempotencyKey === request.idempotencyKey);
      if (existing) {
        for (const key of ['episodeId', 'runId', 'provider', 'approvalId', 'maxCostUsd'] as const) {
          if (existing[key] !== request[key]) throw new Error('Idempotency key conflicts with a different operation');
        }
        return existing; // A retry is never new permission to dispatch a provider request.
      }
      const grants = this.store.read<SpendApprovalGrant[]>(this.grantsFile(request.projectId), []);
      const grant = grants.find(item => item.approvalId === request.approvalId);
      if (!grant || grant.projectId !== request.projectId || (grant.episodeId !== 'all' && grant.episodeId !== request.episodeId) || grant.currency !== 'USD') throw new Error('Approval grant scope mismatch or missing grant');
      if (grant.isRevoked !== false || !Number.isFinite(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= Date.now()) throw new Error('Approval grant is revoked or expired');
      if (!Array.isArray(grant.allowedProviders) || (grant.allowedProviders.length && !grant.allowedProviders.includes(request.provider))) throw new Error('Provider is not approved');
      const project = ledger.reservations.filter(row => row.projectId === request.projectId);
      const held = project.filter(row => ['reserved', 'dispatched', 'unknown'].includes(row.state));
      const grantSpent = micros(grant.actualSpentUsd);
      if (sum([grantSpent, ...held.filter(row => row.approvalId === request.approvalId).map(row => row.reservedMicros), amount]) > micros(grant.maxBudgetUsd)) throw new Error('Approval grant budget exhausted');
      this.assertCurrentCaps(ledger, request, amount);
      const now = new Date().toISOString();
      const row: SpendReservation = { ...request, reservationId: `res_${randomUUID()}`, state: 'reserved', reservedMicros: amount, chargedMicros: 0, createdAt: now, updatedAt: now };
      ledger.reservations.push(row);
      ledger.events.push({ reservationId: row.reservationId, state: row.state, timestamp: now });
      this.store.write(this.file, ledger);
      return row;
    });
  }
  transition(projectId: string, reservationId: string, state: Exclude<ReservationState, 'reserved'>, evidence?: string, actualCostUsd?: number): SpendReservation {
    assertIdentifier(projectId); assertIdentifier(reservationId);
    if (!['dispatched', 'unknown', 'committed', 'released'].includes(state)) throw new Error('Invalid reservation state');
    return this.store.transaction(() => {
      const ledger = this.data();
      const row = ledger.reservations.find(item => item.projectId === projectId && item.reservationId === reservationId);
      if (!row) throw new Error('Reservation not found');
      if (row.state === state) {
        if (state === 'dispatched') throw new Error('Operation already dispatched; reconcile instead of retrying');
        if (state === 'committed' && (actualCostUsd === undefined || micros(actualCostUsd) !== row.chargedMicros)) throw new Error('Conflicting charge replay');
        return row;
      }
      if (['committed', 'released'].includes(row.state)) throw new Error('Reservation is terminal');
      if (state === 'dispatched' && row.state !== 'reserved') throw new Error('Cannot redispatch an uncertain operation');
      if (state === 'unknown' && row.state !== 'dispatched') throw new Error('Only dispatched operations can have unknown effects');
      if (state === 'dispatched') {
        this.assertCurrentCaps(ledger, row, 0); // The existing hold is already part of exposure.
        const grants = this.store.read<SpendApprovalGrant[]>(this.grantsFile(projectId), []);
        const grant = grants.find(item => item.approvalId === row.approvalId);
        if (!grant || grant.isRevoked !== false || !Number.isFinite(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= Date.now()) throw new Error('Approval was revoked or expired before dispatch');
        if (grant.projectId !== row.projectId || (grant.episodeId !== 'all' && grant.episodeId !== row.episodeId) || grant.currency !== 'USD' || !Array.isArray(grant.allowedProviders) || (grant.allowedProviders.length && !grant.allowedProviders.includes(row.provider))) throw new Error('Approval scope changed before dispatch');
        const held = ledger.reservations.filter(item => item.projectId === projectId && item.approvalId === grant.approvalId && ['reserved', 'dispatched', 'unknown'].includes(item.state));
        if (sum([micros(grant.actualSpentUsd), ...held.map(item => item.reservedMicros)]) > micros(grant.maxBudgetUsd)) throw new Error('Approval ceiling changed before dispatch');
      }
      if ((state === 'committed' || (state === 'released' && row.state !== 'reserved')) && (!evidence || !evidence.trim())) throw new Error('Reconciliation evidence is required');
      if (state === 'committed') {
        if (actualCostUsd === undefined) throw new Error('Measured charge required');
        const charge = micros(actualCostUsd);
        if (charge > row.reservedMicros) throw new Error('Charge exceeds reserved ceiling; operator investigation required');
        if (row.state === 'reserved') throw new Error('Operation must be dispatched before committing a charge');
        const file = this.grantsFile(projectId);
        const grants = this.store.read<SpendApprovalGrant[]>(file, []);
        const grant = grants.find(item => item.approvalId === row.approvalId);
        if (!grant) throw new Error('Original approval grant is missing');
        grant.actualSpentUsd = sum([micros(grant.actualSpentUsd), charge]) / 1_000_000;
        this.store.write(file, grants);
        row.chargedMicros = charge;
        row.chargedAt = new Date().toISOString();
      }
      row.state = state; row.updatedAt = new Date().toISOString(); row.evidence = evidence;
      ledger.events.push({ reservationId, state, timestamp: row.updatedAt, evidence });
      this.store.write(this.file, ledger);
      return row;
    });
  }
}
