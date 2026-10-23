import { useRef, useState } from 'react'
import { SettingRow, toast, Toggle } from '../components/ui'
import { exportCSV, exportJSON, importJSON } from '../lib/export'
import { disableReminders, enableReminders, isStandalone, testNotification } from '../lib/notify'
import { formatDate } from '../lib/program'
import { connect, disconnect, pullNow, pushNow, TOKEN_URL } from '../lib/sync'
import { useStore } from '../store'
import type { Settings as S } from '../types'

export default function Settings() {
  const s = useStore()
  const set = (p: Partial<S>) => s.setSettings(p)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const sync = s.sync

  const doConnect = async () => {
    setBusy(true)
    try { await connect(token); setToken(''); toast('Synchro activée ☁️') } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="page">
      <div className="page-title">Réglages</div>

      {!isStandalone() && (
        <div className="card accent small">
          <b>📲 Installer Grind sur ton iPhone</b>
          <div className="muted">Dans Safari : bouton <b>Partager</b> → <b>Sur l’écran d’accueil</b>. L’appli s’ouvrira en plein écran, hors ligne, avec les notifications.</div>
        </div>
      )}

      <div className="section-title">Pendant la séance</div>
      <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
        <SettingRow title="Vue par défaut" desc={s.settings.view === 'guided' ? 'Guidée : un exercice à la fois' : 'Liste : tous les exercices'}>
          <button className="btn sm" onClick={() => set({ view: s.settings.view === 'guided' ? 'list' : 'guided' })}>{s.settings.view === 'guided' ? 'Guidée' : 'Liste'}</button>
        </SettingRow>
        <SettingRow title="Bips sonores" desc="Décompte 3-2-1 et fin de chrono, par-dessus ta musique">
          <Toggle on={s.settings.sounds} onChange={(v) => set({ sounds: v })} />
        </SettingRow>
        <SettingRow title="Voix" desc="Annonce l’exercice, la série et le repos">
          <Toggle on={s.settings.voice} onChange={(v) => set({ voice: v })} />
        </SettingRow>
        <SettingRow title="Métronome de tempo" desc="Bouton ♪ sur les exos avec tempo (ex. 3-1-1)">
          <Toggle on={s.settings.metronome} onChange={(v) => set({ metronome: v })} />
        </SettingRow>
        <SettingRow title="Garder l’écran allumé" desc="Recommandé : iOS coupe le chrono écran verrouillé">
          <Toggle on={s.settings.wakeLock} onChange={(v) => set({ wakeLock: v })} />
        </SettingRow>
        <SettingRow title="Messages du coach" desc="Petits rappels et motivation">
          <Toggle on={s.settings.coach} onChange={(v) => set({ coach: v })} />
        </SettingRow>
      </div>
      <div className="small muted">💡 Si tu n’entends pas les bips : vérifie que ton iPhone n’est pas en mode silencieux.</div>

      <div className="section-title">Rappels</div>
      <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
        <SettingRow title="Notifications" desc="18h30 les jours de séance et de basket, 14h le week-end">
          <Toggle on={s.settings.reminders} onChange={async (v) => {
            if (v) { const err = await enableReminders(); if (err) toast(err); else toast('Rappels activés 🔔') }
            else void disableReminders()
          }} />
        </SettingRow>
        {s.settings.reminders && s.push && (
          <SettingRow title="Tester" desc="Affiche une notification maintenant">
            <button className="btn sm" onClick={() => void testNotification()}>Test</button>
          </SettingRow>
        )}
      </div>

      <div className="section-title">Synchro cloud</div>
      <div className="card">
        {sync.token && sync.gistId ? (
          <>
            <div className="row between">
              <div>
                <div style={{ fontWeight: 600 }}>☁️ Connectée</div>
                <div className="small muted">
                  {sync.status === 'syncing' ? 'Synchronisation…' : sync.status === 'error' ? `Erreur : ${sync.error}` : sync.lastSync ? `Dernière synchro ${new Date(sync.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </div>
              </div>
              <button className="btn sm" onClick={async () => { await pullNow(); await pushNow(); toast('Synchronisé') }}>Synchroniser</button>
            </div>
            <button className="btn sm ghost danger" style={{ alignSelf: 'flex-start' }} onClick={() => { if (confirm('Déconnecter la synchro ? Tes données restent sur le téléphone.')) disconnect() }}>Déconnecter</button>
          </>
        ) : (
          <>
            <div className="small muted">Tes données sont sauvegardées dans un Gist GitHub privé. À faire une seule fois :</div>
            <div className="small"><b>1.</b> Crée un jeton (déjà pré-rempli, coche juste « No expiration » puis <b>Generate token</b>) :</div>
            <a className="btn block" href={TOKEN_URL} target="_blank" rel="noreferrer">Créer le jeton sur GitHub ↗</a>
            <div className="small"><b>2.</b> Colle-le ici :</div>
            <input className="input" placeholder="ghp_…" value={token} onChange={(e) => setToken(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            <button className="btn primary block" disabled={!token.trim() || busy} onClick={doConnect}>{busy ? 'Connexion…' : 'Connecter'}</button>
          </>
        )}
      </div>

      <div className="section-title">Programme</div>
      <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
        <SettingRow title="Début du programme" desc={formatDate(s.startDate)}>
          <input type="date" className="input" style={{ width: 150 }} value={s.startDate} onChange={(e) => e.target.value && s.setStartDate(e.target.value)} />
        </SettingRow>
        <SettingRow title="Réafficher toutes les consignes" desc="Repasse tous les exercices en mode coaché">
          <button className="btn sm" onClick={() => { Object.keys(s.mastered).forEach((k) => s.setMastered(k, false)); toast('Mode coaché réactivé partout') }}>Réinitialiser</button>
        </SettingRow>
      </div>

      <div className="section-title">Données</div>
      <div className="card">
        <button className="btn block" onClick={() => void exportCSV()}>📊 Exporter en CSV (Excel / Sheets)</button>
        <button className="btn block" onClick={() => void exportJSON()}>💾 Sauvegarde complète (JSON)</button>
        <button className="btn block" onClick={() => file.current?.click()}>📥 Restaurer une sauvegarde</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          try { await importJSON(f); toast('Sauvegarde restaurée') } catch (err) { toast((err as Error).message) }
          e.target.value = ''
        }} />
      </div>

      <div className="center tiny muted">Grind · v{__APP_VERSION__} · fait pour Matei 💪</div>
    </div>
  )
}
