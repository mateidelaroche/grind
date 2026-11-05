import { EXERCISES } from '../data/exercises'
import { NOISY, ROOMY, VARIANTS, type Variant } from '../data/variants'
import { buildSteps, gearForExercise, levelOf, programLevel, type BuildOpts } from './program'
import type { Band, Item, Problem, SessionId, Swap, Unavailable } from '../types'

export type SwapChoice = Omit<Swap, 'fromRound' | 'orig'>
type Blocked = ReadonlySet<Unavailable>

export const PROBLEM_LABEL: Record<Problem, string> = {
  elastique: 'Élastique cassé ou indisponible',
  porte: 'La porte ne tient pas ou l’accroche glisse',
  lit: 'Lit ou accroche du lit indisponible',
  sac: 'Sac à dos indisponible',
  livres: 'Pas de livres',
  place: 'Pas assez de place',
  bruit: 'Je dois faire moins de bruit',
}

export const UNAVAILABLE_LABEL: Record<Unavailable, string> = {
  porte: '🚪 Accroche de porte', lit: '🛏️ Lit', sac: '🎒 Sac à dos', livres: '📚 Livres',
  'band:L': 'Élastique L', 'band:M': 'Élastique M', 'band:F': 'Élastique F',
}

const BANDS: Band[] = ['L', 'M', 'F']

export function clashes(ex: string, level: number, blocked: Blocked) {
  const g = gearForExercise(ex, level)
  return g.bands.some((b) => blocked.has(`band:${b}`)) || g.equip.some((e) => blocked.has(e as Unavailable))
}

/** Décale une fourchette de reps : « 10-15 / bras » → « 13-18 / bras ». */
export const shiftReps = (reps: string, d: number) => reps.replace(/\d+/g, (n) => String(Math.max(5, +n + d)))

/** Même exercice avec un autre élastique, le plus proche d'abord, reps et tempo adaptés à la résistance. */
function bandOptions(ex: string, level: number, item: Item, blocked: Blocked): SwapChoice[] {
  const cur = levelOf(ex, level)?.band
  if (!cur) return []
  const at = BANDS.indexOf(cur)
  // À écart égal, le plus résistant d'abord : il préserve l'effort.
  const order = BANDS.filter((b) => b !== cur).sort((a, b) => Math.abs(BANDS.indexOf(a) - at) - Math.abs(BANDS.indexOf(b) - at) || BANDS.indexOf(b) - BANDS.indexOf(a))
  const out: SwapChoice[] = []
  for (const b of order) {
    const lvl = (EXERCISES[ex].levels ?? []).findIndex((l) => l.band === b && !l.uni)
    if (lvl < 0 || clashes(ex, lvl, blocked)) continue
    const lighter = BANDS.indexOf(b) < at
    const tempo = lighter ? item.tempo?.replace(/^\d+/, (n) => String(+n + 1)) : item.tempo
    out.push({
      ex, level: lvl, reps: item.reps && shiftReps(item.reps, lighter ? 3 : -2), duration: item.duration, durationLabel: item.durationLabel, tempo,
      note: lighter ? 'Élastique plus léger : plus de reps, descente plus lente' : 'Élastique plus dur : moins de reps, garde le contrôle',
    })
  }
  return out
}

function pickLevel(v: Variant, levels: Record<string, number>, blocked: Blocked): number | undefined {
  if (v.level !== undefined) return clashes(v.ex, v.level, blocked) ? undefined : v.level
  const all = EXERCISES[v.ex].levels ?? []
  const base = Math.min(levels[v.ex] ?? programLevel(v.ex), Math.max(0, all.length - 1))
  if (!clashes(v.ex, base, blocked)) return base
  // Le niveau habituel utilise le matériel manquant : le plus proche sans lui, à deux bras ou deux jambes.
  return all.map((l, i) => ({ l, i })).filter((x) => !x.l.uni && !clashes(v.ex, x.i, blocked)).sort((a, b) => Math.abs(a.i - base) - Math.abs(b.i - base))[0]?.i
}

export interface Ctx { levels: Record<string, number>; unavailable: Unavailable[] }
export interface Base { ex: string; level: number; item: Item }

const problemBlocks = (p: Problem | undefined, current: { ex: string; level: number }): Unavailable[] => {
  if (p === 'elastique') return gearForExercise(current.ex, current.level).bands.map((b) => `band:${b}` as const)
  return p === 'porte' || p === 'lit' || p === 'sac' || p === 'livres' ? [p] : []
}

/** Remplacements possibles de `base`, le meilleur d'abord. `current` : ce qui est prévu à cette série. */
export function optionsFor(base: Base, ctx: Ctx, problem?: Problem, current: { ex: string; level: number } = base): SwapChoice[] {
  const blocked = new Set<Unavailable>([...ctx.unavailable, ...problemBlocks(problem, current)])
  const out: SwapChoice[] = clashes(base.ex, base.level, blocked) ? bandOptions(base.ex, base.level, base.item, blocked) : []
  for (const v of VARIANTS[base.ex] ?? []) {
    if ((problem === 'bruit' && NOISY.has(v.ex)) || (problem === 'place' && ROOMY.has(v.ex))) continue
    const level = pickLevel(v, ctx.levels, blocked)
    if (level !== undefined) out.push({ ...v, level })
  }
  const same = (o: SwapChoice, x: { ex: string; level: number }) => o.ex === x.ex && o.level === x.level
  return out.filter((o, i) => !same(o, base) && !same(o, current) && out.findIndex((x) => same(x, o)) === i)
}

/** Problèmes à proposer : seulement ceux qui concernent l'exercice et pour lesquels une variante existe. */
export function problemsFor(base: Base, ctx: Ctx, current: { ex: string; level: number } = base): Problem[] {
  const g = gearForExercise(current.ex, current.level)
  const list: Problem[] = [
    ...(g.bands.length ? ['elastique' as const] : []),
    ...(['porte', 'lit', 'sac', 'livres'] as const).filter((e) => (g.equip as string[]).includes(e)),
    'place', 'bruit',
  ]
  return list.filter((p) => optionsFor(base, ctx, p, current).length > 0)
}

/** Remplacements à appliquer au démarrage : variantes prévues depuis les fiches, puis matériel indisponible. */
export function autoSwaps(sid: SessionId, o: BuildOpts, ctx: Ctx, planned: Record<string, SwapChoice>) {
  const swaps: Record<string, Swap[]> = {}
  const used: string[] = []
  const seen = new Set<string>()
  const blocked = new Set(ctx.unavailable)
  for (const st of buildSteps(sid, o)) {
    if (st.kind !== 'work' || !st.slot || seen.has(st.slot)) continue
    seen.add(st.slot)
    const p = planned[st.ex!]
    if (p && !clashes(p.ex, p.level, blocked)) {
      swaps[st.slot] = [{ ...p, fromRound: 1 }]
      used.push(st.ex!)
    } else if (clashes(st.ex!, st.level ?? 0, blocked)) {
      const first = optionsFor({ ex: st.ex!, level: st.level ?? 0, item: st.item! }, ctx)[0]
      if (first) swaps[st.slot] = [{ ...first, fromRound: 1 }]
    }
  }
  return { swaps, used }
}
