/**
 * Run: npx tsx scripts/verify-escala-contagem.ts
 */
import { pickOverlappingRotation } from '../src/lib/gestao-tripulantes/escala-contagem';

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const weekStart = new Date(2025, 10, 22, 0, 0, 0, 0); // Sat 22/11/2025
const weekEnd = new Date(2025, 10, 28, 23, 59, 59, 999);

const stb = { id: 'stb', start: '2025-11-01', end: '2025-12-31', type: 'stb' };
const onNovo = { id: 'on-new', start: '2025-11-22', end: '2025-12-06', type: 'normal' };

const winnerStartWeek = pickOverlappingRotation([stb, onNovo], weekStart, weekEnd);
assert(winnerStartWeek?.id === 'on-new', 'new ON starting this week beats long STB');

const nextWeekStart = new Date(2025, 10, 29, 0, 0, 0, 0);
const nextWeekEnd = new Date(2025, 11, 5, 23, 59, 59, 999);
const winnerNext = pickOverlappingRotation([stb, onNovo], nextWeekStart, nextWeekEnd);
assert(winnerNext?.id === 'on-new', 'new ON still wins later weeks (later start date)');

const beforeStart = new Date(2025, 10, 8, 0, 0, 0, 0);
const beforeEnd = new Date(2025, 10, 14, 23, 59, 59, 999);
const winnerBefore = pickOverlappingRotation([stb, onNovo], beforeStart, beforeEnd);
assert(winnerBefore?.id === 'stb', 'weeks before the new ON stay STB');

// Regression: MIO OFF-C with the identical period must not shadow the local ON
// the operator just saved (manual launch wins exact ties via origem='local').
const mioOffc = { id: 'offc-mio', start: '2026-10-17', end: '2026-10-31', type: 'offc', origem: 'mio' };
const onLocal = { id: 'on-local', start: '2026-10-17', end: '2026-10-31', type: 'normal', origem: 'local' };
const oct17 = new Date(2026, 9, 17, 0, 0, 0, 0); // Sat 17/10/2026
const oct23 = new Date(2026, 9, 23, 23, 59, 59, 999);
const winnerTie = pickOverlappingRotation([mioOffc, onLocal], oct17, oct23);
assert(winnerTie?.id === 'on-local', 'local ON beats MIO OFF-C with identical dates');

const oct24Start = new Date(2026, 9, 24, 0, 0, 0, 0);
const oct30End = new Date(2026, 9, 30, 23, 59, 59, 999);
const winnerTie2 = pickOverlappingRotation([mioOffc, onLocal], oct24Start, oct30End);
assert(winnerTie2?.id === 'on-local', 'local ON keeps winning mid-period columns');

// Same tie WITHOUT the local marker keeps the legacy specific-type preference.
const winnerLegacy = pickOverlappingRotation(
  [mioOffc, { ...onLocal, origem: 'mio' }],
  oct17,
  oct23
);
assert(winnerLegacy?.id === 'offc-mio', 'without origem=local the specific MIO type still wins');

console.log('ESCALA_CONTAGEM_VERIFY_OK');
