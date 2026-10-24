import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { del, get, set } from 'idb-keyval'
import { DEFAULT_START, programLevel, today } from './lib/program'
import type {
  BasketLog, FoodLog, ItemEdit, LevelEvent, Measures, RunLog, RunSplit, RunStep, SessionId, SetRecord, Settings, TestId, TestResult, Workout,
} from './types'

const idbStorage: StateStorage = {
  getItem: async (k) => (await get<string>(k)) ?? null,
  setItem: (k, v) => set(k, v),
  removeItem: (k) => del(k),
}

export interface ActiveSession {
  workoutId: string
  session: SessionId
  express: boolean
  stepIndex: number
  /** Clés d'étapes validées. */
  done: Record<string, true>
}

/** Sortie en cours (persistée pour survivre à un redémarrage de l'appli, jamais synchronisée). */
export interface ActiveRun {
  id: string
  date: string
  plan: number
  indoor: boolean
  steps: RunStep[]
  startedAt: number
  /** Temps cumulé en pause (ms) et début de la pause en cours. */
  pausedMs: number
  pausedAt?: number
  step: number
  /** Début de l'étape en cours : temps actif (s) et distance (m). */
  stepT0: number
  stepD0: number
  splits: RunSplit[]
}

/** Données synchronisées dans le cloud. */
export interface SyncedData {
  startDate: string
  levels: Record<string, number>
  mastered: Record<string, boolean>
  timeTargets: Record<string, number>
  edits: Record<string, ItemEdit>
  overrides: Record<string, string>
  workouts: Workout[]
  basket: Record<string, BasketLog>
  settings: Settings
  push?: PushSubscriptionJSON
  weights: Record<string, number>
  measures: Record<string, Measures>
  goalWeight: number
  tests: Partial<Record<TestId, TestResult>>
  levelLog: LevelEvent[]
  food: Record<string, FoodLog>
  runs: RunLog[]
  /** Début du programme course (par défaut : 2 semaines après la muscu). */
  runStart?: string
  updatedAt: number
}

export interface SyncState {
  token?: string
  gistId?: string
  lastSync?: number
  status: 'off' | 'idle' | 'syncing' | 'error'
  error?: string
}

interface State extends SyncedData {
  active?: ActiveSession
  activeRun?: ActiveRun
  sync: SyncState
  hydrated: boolean

  touch: () => void
  setSettings: (s: Partial<Settings>) => void
  setLevel: (ex: string, lvl: number) => void
  setMastered: (ex: string, v: boolean) => void
  setTimeTarget: (ex: string, s: number) => void
  setEdit: (key: string, e: ItemEdit | undefined) => void
  setOverride: (date: string, v: string | undefined) => void
  setBasket: (date: string, log: BasketLog | undefined) => void
  setStartDate: (d: string) => void
  setWeight: (date: string, kg: number | undefined) => void
  setMeasures: (date: string, m: Measures | undefined) => void
  setGoalWeight: (kg: number) => void
  setTest: (id: TestId, r: TestResult | undefined) => void
  setFood: (date: string, f: FoodLog) => void
  setRunStart: (d: string | undefined) => void
  startRun: (r: Pick<ActiveRun, 'plan' | 'indoor' | 'steps'>) => void
  patchRun: (p: Partial<ActiveRun>) => void
  finishRun: (log: Omit<RunLog, 'id' | 'date' | 'plan' | 'indoor' | 'startedAt'>) => string | undefined
  abandonRun: () => void
  setRunKnee: (id: string, k: { knee?: number; kneeNext?: number }) => void
  deleteRun: (id: string) => void

  startWorkout: (session: SessionId, express: boolean, date: string) => void
  setStep: (i: number) => void
  markStep: (key: string, done: boolean) => void
  recordSet: (recKey: string, rec: Omit<SetRecord, 'done' | 'flags'>, delta: number) => void
  flagSet: (recKey: string, flag: 'hard' | 'easy') => void
  finishWorkout: () => string | undefined
  abandonWorkout: () => void
  deleteWorkout: (id: string) => void

  setSync: (s: Partial<SyncState>) => void
  setPush: (p: PushSubscriptionJSON | undefined) => void
  applyRemote: (d: SyncedData) => void
}

export const DEFAULT_SETTINGS: Settings = {
  sounds: true, voice: false, metronome: false, coach: true, wakeLock: true, view: 'guided', reminders: false, anim3d: true,
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export const useStore = create<State>()(
  persist(
    (setS, getS) => {
      const upd = (fn: (s: State) => Partial<State>) => setS((s) => ({ ...fn(s), updatedAt: Date.now() }))
      const updWorkout = (fn: (w: Workout) => Workout) =>
        upd((s) => ({ workouts: s.workouts.map((w) => (w.id === s.active?.workoutId ? fn(w) : w)) }))
      return {
        startDate: DEFAULT_START,
        levels: {}, mastered: {}, timeTargets: {}, edits: {}, overrides: {},
        workouts: [], basket: {},
        weights: {}, measures: {}, goalWeight: 75, tests: {}, levelLog: [], food: {}, runs: [],
        settings: DEFAULT_SETTINGS,
        updatedAt: 0,
        sync: { status: 'off' },
        hydrated: false,

        touch: () => upd(() => ({})),
        setSettings: (p) => upd((s) => ({ settings: { ...s.settings, ...p } })),
        setLevel: (ex, lvl) => upd((s) => {
          const prev = s.levels[ex] ?? programLevel(ex)
          const levelLog = lvl > prev ? [...s.levelLog, { ex, level: lvl, date: today() }] : s.levelLog
          return { levels: { ...s.levels, [ex]: lvl }, levelLog }
        }),
        setMastered: (ex, v) => upd((s) => ({ mastered: { ...s.mastered, [ex]: v } })),
        setTimeTarget: (ex, sec) => upd((s) => ({ timeTargets: { ...s.timeTargets, [ex]: sec } })),
        setEdit: (key, e) => upd((s) => {
          const edits = { ...s.edits }
          if (e) edits[key] = e
          else delete edits[key]
          return { edits }
        }),
        setOverride: (date, v) => upd((s) => {
          const overrides = { ...s.overrides }
          if (v) overrides[date] = v
          else delete overrides[date]
          return { overrides }
        }),
        setBasket: (date, log) => upd((s) => {
          const basket = { ...s.basket }
          if (log) basket[date] = log
          else delete basket[date]
          return { basket }
        }),
        setStartDate: (d) => upd(() => ({ startDate: d })),
        setWeight: (date, kg) => upd((s) => {
          const weights = { ...s.weights }
          if (kg) weights[date] = kg
          else delete weights[date]
          return { weights }
        }),
        setMeasures: (date, m) => upd((s) => {
          const measures = { ...s.measures }
          if (m && Object.values(m).some((v) => v)) measures[date] = m
          else delete measures[date]
          return { measures }
        }),
        setGoalWeight: (kg) => upd(() => ({ goalWeight: kg })),
        setTest: (id, r) => upd((s) => {
          const tests = { ...s.tests }
          if (r) tests[id] = r
          else delete tests[id]
          return { tests }
        }),
        setFood: (date, f) => upd((s) => ({ food: { ...s.food, [date]: { ...s.food[date], ...f } } })),
        setRunStart: (d) => upd(() => ({ runStart: d })),

        startRun: (r) => setS({
          activeRun: { ...r, id: uid(), date: today(), startedAt: Date.now(), pausedMs: 0, step: 0, stepT0: 0, stepD0: 0, splits: [] },
        }),
        patchRun: (p) => setS((s) => (s.activeRun ? { activeRun: { ...s.activeRun, ...p } } : {})),
        finishRun: (log) => {
          const a = getS().activeRun
          if (!a) return
          const run: RunLog = { ...log, id: a.id, date: a.date, plan: a.plan, indoor: a.indoor || undefined, startedAt: a.startedAt }
          upd((s) => ({ runs: [...s.runs, run], activeRun: undefined }))
          return a.id
        },
        abandonRun: () => setS({ activeRun: undefined }),
        setRunKnee: (id, k) => upd((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, ...k, edited: Date.now() } : r)) })),
        deleteRun: (id) => upd((s) => ({ runs: s.runs.filter((r) => r.id !== id) })),

        startWorkout: (session, express, date) => {
          const id = uid()
          const w: Workout = { id, date, session, express, startedAt: Date.now(), sets: {}, completed: false }
          upd((s) => ({ workouts: [...s.workouts, w], active: { workoutId: id, session, express, stepIndex: 0, done: {} } }))
        },
        setStep: (i) => setS((s) => (s.active ? { active: { ...s.active, stepIndex: i } } : {})),
        markStep: (key, done) => setS((s) => {
          if (!s.active) return {}
          const d = { ...s.active.done }
          if (done) d[key] = true
          else delete d[key]
          return { active: { ...s.active, done: d } }
        }),
        recordSet: (recKey, rec, delta) => updWorkout((w) => {
          const prev = w.sets[recKey]
          const done = Math.max(0, Math.min(rec.total, (prev?.done ?? 0) + delta))
          const best = Math.max(prev?.best ?? 0, rec.best ?? 0) || undefined
          return { ...w, sets: { ...w.sets, [recKey]: { ...rec, done, best, flags: prev?.flags ?? [] } } }
        }),
        flagSet: (recKey, flag) => updWorkout((w) => {
          const prev = w.sets[recKey]
          if (!prev) return w
          const flags = prev.flags.includes(flag) ? prev.flags.filter((f) => f !== flag) : [...prev.flags.filter((f) => f !== (flag === 'hard' ? 'easy' : 'hard')), flag]
          return { ...w, sets: { ...w.sets, [recKey]: { ...prev, flags } } }
        }),
        finishWorkout: () => {
          const a = getS().active
          if (!a) return
          updWorkout((w) => ({ ...w, endedAt: Date.now(), completed: true }))
          setS({ active: undefined })
          return a.workoutId
        },
        abandonWorkout: () => {
          const a = getS().active
          if (!a) return
          const w = getS().workouts.find((x) => x.id === a.workoutId)
          const anyDone = w && Object.values(w.sets).some((r) => r.done > 0)
          upd((s) => ({
            active: undefined,
            workouts: anyDone
              ? s.workouts.map((x) => (x.id === a.workoutId ? { ...x, endedAt: Date.now() } : x))
              : s.workouts.filter((x) => x.id !== a.workoutId),
          }))
        },
        deleteWorkout: (id) => upd((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),

        setSync: (p) => setS((s) => ({ sync: { ...s.sync, ...p } })),
        setPush: (p) => upd(() => ({ push: p })),
        // Un document plus ancien (V1) n'a pas tous les champs : on garde l'existant pour ceux-là.
        applyRemote: (d) => setS((s) => ({
          ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)),
          settings: { ...DEFAULT_SETTINGS, ...s.settings, ...d.settings },
        })),
      }
    },
    {
      name: 'grind',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => {
        const { hydrated: _h, ...rest } = s
        void _h
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<State>
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        return { ...current, ...p, runs: p.runs ?? [], settings: { ...DEFAULT_SETTINGS, ...p.settings }, sync: { status: 'off', ...p.sync } }
      },
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
)

export function syncedSnapshot(s: State): SyncedData {
  return {
    startDate: s.startDate, levels: s.levels, mastered: s.mastered, timeTargets: s.timeTargets, edits: s.edits,
    overrides: s.overrides, workouts: s.workouts, basket: s.basket, settings: s.settings, push: s.push,
    weights: s.weights, measures: s.measures, goalWeight: s.goalWeight, tests: s.tests, levelLog: s.levelLog, food: s.food,
    runs: s.runs, runStart: s.runStart, updatedAt: s.updatedAt,
  }
}
