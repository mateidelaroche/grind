export const COACH_LINES = [
  'La régularité bat l’intensité. 3 séances par semaine, pendant 12 semaines.',
  'Jour sans énergie = séance express. Jamais zéro.',
  'Routine genoux avant chaque séance jambes et chaque basket.',
  '+1 rep, c’est une victoire.',
  'Technique d’abord, charge ensuite.',
  'La descente lente (2-3 s) fait plus que tu ne crois.',
  'Jamais de jambes la veille du basket.',
  'Tu dors 8 h : garde-les. C’est la nuit que tu grossis.',
  'Une série confortable ne fait pas grossir. RIR 1-2.',
  'Un verre de lait après la séance, 30 secondes, zéro effort.',
  'Tu ne te vois pas changer dans le miroir. Les photos, si.',
  'Deux semaines ratées, c’est là que tout s’arrête. Pas une séance ratée.',
]

export const DONE_LINES = [
  'Séance pliée. Bien joué Matei 💪',
  'Encore une brique de posée.',
  'C’est comme ça qu’on construit un physique.',
  'Propre. Récupère bien, mange un peu plus.',
]

export const pick = <T,>(arr: T[], seed = new Date().getDate()) => arr[seed % arr.length]
