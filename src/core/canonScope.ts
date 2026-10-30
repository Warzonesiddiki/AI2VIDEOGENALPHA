import { validateCanonHardRules } from './rules.ts';

/** The built-in keyword heuristic describes only the original Ternfall project.
 * It is not a general validator of a project's stored series bible. */
export function checkProjectCanon(projectId: string, script: string) {
  if (!script.trim()) return { evaluated: false, violatesHardRules: false, infractions: [] as string[], reason: 'No nonempty script was available to evaluate.' };
  if (projectId !== 'proj_ternfall_01') return { evaluated: false, violatesHardRules: false, infractions: [] as string[], reason: 'No automated canon checks are configured for this project. Review its series bible manually.' };
  return { ...validateCanonHardRules(script), evaluated: true, reason: 'Limited built-in Ternfall keyword heuristic only; it cannot establish canon compliance.' };
}
