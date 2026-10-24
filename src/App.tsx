import { useEffect, useState } from 'react'
import { IconBook, IconChart, IconGear, IconList, IconToday } from './components/icons'
import { ConfettiHost } from './components/Confetti'
import { ToastHost } from './components/ui'
import Food from './screens/Food'
import { today } from './lib/program'
import { ExerciseDetail, ExercisesList } from './screens/Exercises'
import { HistoryScreen, Recap } from './screens/History'
import { SessionDetail, SessionsList } from './screens/Sessions'
import Settings from './screens/Settings'
import Today from './screens/Today'
import Workout from './screens/Workout'
import { useStore } from './store'
import type { SessionId } from './types'

type Tab = 'today' | 'sessions' | 'exercises' | 'history' | 'settings'
type Page =
  | { p: 'session'; id: SessionId }
  | { p: 'exercise'; id: string }
  | { p: 'recap'; id: string; fresh?: boolean }
  | { p: 'food' }

const TABS: { id: Tab; label: string; icon: () => React.JSX.Element }[] = [
  { id: 'today', label: 'Aujourd’hui', icon: IconToday },
  { id: 'sessions', label: 'Séances', icon: IconList },
  { id: 'exercises', label: 'Exercices', icon: IconBook },
  { id: 'history', label: 'Historique', icon: IconChart },
  { id: 'settings', label: 'Réglages', icon: IconGear },
]

export default function App() {
  const hydrated = useStore((s) => s.hydrated)
  const active = useStore((s) => s.active)
  const startWorkout = useStore((s) => s.startWorkout)
  const [tab, setTab] = useState<Tab>('today')
  const [stack, setStack] = useState<Page[]>([])
  const page = stack.at(-1)
  const push = (p: Page) => setStack((s) => [...s, p])
  const pop = () => setStack((s) => s.slice(0, -1))

  useEffect(() => { window.scrollTo(0, 0) }, [tab, page])

  if (!hydrated) return null

  const start = (session: SessionId, express: boolean) => {
    if (!active) startWorkout(session, express, today())
    setStack([])
  }

  if (active) {
    return (
      <>
        <Workout onFinished={(id) => { setTab('today'); setStack([{ p: 'recap', id, fresh: true }]) }} />
        <ToastHost />
      </>
    )
  }

  let content: React.ReactNode
  if (page?.p === 'session') content = <SessionDetail id={page.id} onBack={pop} onStart={start} onExercise={(id) => push({ p: 'exercise', id })} />
  else if (page?.p === 'exercise') content = <ExerciseDetail id={page.id} onBack={pop} />
  else if (page?.p === 'recap') content = <Recap id={page.id} fresh={page.fresh} onBack={pop} />
  else if (page?.p === 'food') content = <Food onBack={pop} />
  else if (tab === 'today') {
    content = (
      <Today
        onStart={start}
        onOpenSession={(id) => push({ p: 'session', id })}
        onFood={() => push({ p: 'food' })}
        onPhotos={() => { try { sessionStorage.setItem('hist', 'corps') } catch { /* ignore */ } setTab('history') }}
      />
    )
  }
  else if (tab === 'sessions') content = <SessionsList onOpen={(id) => push({ p: 'session', id })} />
  else if (tab === 'exercises') content = <ExercisesList onOpen={(id) => push({ p: 'exercise', id })} />
  else if (tab === 'history') content = <HistoryScreen onOpen={(id) => push({ p: 'recap', id })} />
  else content = <Settings />

  return (
    <div className="app">
      {content}
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id && !page ? 'on' : ''} onClick={() => { setTab(t.id); setStack([]) }}>
            <t.icon />
            {t.label}
          </button>
        ))}
      </nav>
      <ToastHost />
      <ConfettiHost />
    </div>
  )
}
