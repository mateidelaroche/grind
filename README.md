# Grind 💪

Appli perso (PWA) pour suivre le programme muscu à la maison de Matei : séances guidées, animations des exercices, minuteur avec bips, historique, synchro cloud et rappels.

👉 **https://mateidelaroche.github.io/grind/** (à ouvrir dans Safari → Partager → *Sur l'écran d'accueil*)

## Stack

- React 19 + TypeScript + Vite, `vite-plugin-pwa` (service worker `src/sw.ts`, hors ligne + push)
- État : Zustand persisté dans IndexedDB (`src/store.ts`)
- Synchro : un Gist GitHub secret (`grind-data.json`) via un jeton `gist` (`src/lib/sync.ts`)
- Rappels : l'appli publie le planning des 14 prochains jours dans le Gist, la GitHub Action `reminders.yml` envoie le push (Web Push / VAPID)
- Animations : mini-moteur de squelette 2D (FK + IK à 2 os) dans `src/anim/`

## Arborescence

| Chemin | Rôle |
|---|---|
| `src/data/exercises.ts` | Fiches exercices + niveaux de progression |
| `src/data/sessions.ts` | Séances A / B / C, routines, échauffement, retour au calme |
| `src/lib/program.ts` | Semaines, phases, planning, construction des étapes, suggestions |
| `src/anim/anims.ts` | Poses clés de chaque animation |
| `src/screens/` | Écrans |
| `gallery.html` | (dev) toutes les poses clés pour vérifier les animations |

## Dev

```bash
npm install
npm run dev        # http://localhost:5173/grind/  (galerie : /grind/gallery.html)
npm run build
npm run icons      # régénère les PNG depuis public/icon.svg
```

Chaque push sur `main` redéploie automatiquement GitHub Pages.

## Secrets GitHub (rappels)

- `VAPID_PRIVATE` : clé privée VAPID (la publique est dans `src/lib/notify.ts`)
- `GIST_ID` : ID du Gist de données (créé par l'appli à la première connexion de la synchro)
