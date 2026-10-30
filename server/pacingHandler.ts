import type { Request, Response } from 'express';
import { calculateNarrationPacing, calculateWordCount } from '../src/core/rules.ts';

/**
 * Advisory pacing calculator. Range-checks its inputs instead of forwarding
 * arbitrary values into duration math (which would emit Infinity/NaN that JSON
 * silently serializes as null). The 80–220 wpm window is the same pacing
 * policy the episode and series writers enforce.
 */
export function pacingCalculationHandler(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  const { text, targetWpm = 145 } = req.body ?? {};
  if (text !== undefined && (typeof text !== 'string' || text.length > 200_000)) {
    res.status(400).json({ ok: false, code: 'PACING_INVALID_INPUT', error: 'Provide narration text of at most 200,000 characters.' });
    return;
  }
  if (typeof targetWpm !== 'number' || !Number.isFinite(targetWpm) || targetWpm < 80 || targetWpm > 220) {
    res.status(400).json({ ok: false, code: 'PACING_INVALID_INPUT', error: 'targetWpm must be a number between 80 and 220.' });
    return;
  }
  const wordCount = calculateWordCount(typeof text === 'string' ? text : '');
  const pacing = calculateNarrationPacing(wordCount, targetWpm);
  res.json({ ok: true, data: pacing });
}
