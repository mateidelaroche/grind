export type Band = 'L' | 'M' | 'F'
export type Sac = 'léger' | 'moyen' | 'lourd'
export type Anchor = 'bas' | 'milieu' | 'haut'
export type Equip = 'elastique' | 'sac' | 'lit' | 'porte' | 'mur' | 'livres'

export interface Level {
  label: string
  band?: Band
  sac?: Sac
  /** Animation spécifique à ce niveau (ex. fente bulgare). */
  anim?: string
}

export interface Exercise {
  id: string
  name: string
  muscles: string
  /** Matériel de base (le niveau peut ajouter un élastique ou le sac). */
  equipment: Equip[]
  anchor?: Anchor
  anim: string
  setup?: string
  execution: string
  errors?: string
  knee?: string
  info?: string
  levels?: Level[]
  /** Exercice fait d'un côté puis de l'autre. */
  perSide?: 'jambe' | 'bras' | 'côté'
}

export interface Item {
  ex: string
  sets: number
  /** Fourchette affichée, ex. "8-12". */
  reps?: string
  /** Exercice en temps : durée cible par défaut, en secondes. */
  duration?: number
  /** Texte de la fourchette de temps, ex. "30-60 s". */
  durationLabel?: string
  tempo?: string
  /** Niveau de départ dans exercise.levels. */
  level?: number
  /** Niveau minimum imposé à partir d'une semaine donnée (fente arrière → bulgare). */
  minLevelFromWeek?: Record<number, number>
  note?: string
}

export interface Block {
  id: string
  items: Item[]
  /** Repos après chaque tour du bloc (s). */
  rest: number
  /** Bloc conservé dans la séance express. */
  express?: boolean
  /** Bloc des exos principaux concernés par le rest-pause S10-S12. */
  restPause?: boolean
}

export type SessionId = 'A' | 'B' | 'C' | 'GENOUX' | 'BONUS' | 'WARMUP' | 'COOLDOWN'

export interface Session {
  id: SessionId
  name: string
  subtitle: string
  kind: 'muscu' | 'routine'
  warmup: 'general' | 'genoux' | 'none'
  cooldown: boolean
  blocks: Block[]
  duration: string
}

export type DayPlan =
  | { type: 'session'; session: SessionId; moved?: boolean }
  | { type: 'basket'; match?: boolean }
  | { type: 'rest' }

export interface SetRecord {
  ex: string
  done: number
  total: number
  level: number
  flags: ('hard' | 'easy')[]
}

export interface Workout {
  id: string
  date: string
  session: SessionId
  express: boolean
  startedAt: number
  endedAt?: number
  /** clé = blockId:itemIndex */
  sets: Record<string, SetRecord>
  completed: boolean
}

export interface BasketLog {
  done: boolean
  knee?: number
}

export interface Settings {
  sounds: boolean
  voice: boolean
  metronome: boolean
  coach: boolean
  wakeLock: boolean
  view: 'guided' | 'list'
  reminders: boolean
}

export interface ItemEdit {
  sets?: number
  reps?: string
  rest?: number
}
