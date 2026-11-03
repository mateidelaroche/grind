// Démos YouTube par exercice (clé = id d'exercice, ou animation d'un niveau : fente bulgare, unilatéral…).
// Vérifiées le 03/11/2026 : la vidéo existe et son intégration est autorisée (oEmbed).
export interface VideoRef {
  id: string
  channel: string
  title: string
  /** Passage par défaut joué en boucle (s) ; sinon les 10 premières secondes. */
  loop?: [number, number]
  /** Vidéo verticale (Short). */
  vertical?: boolean
}

export const VIDEOS: Record<string, VideoRef> = {
  "pushup": { id: "zUymek3A64A", channel: "Criticalbench", title: "Proper Push Up Form #shorts", vertical: true },
  "pushup-decline": { id: "x3XztsyxHp4", channel: "Calixpert", title: "How To Do Decline Push-Ups | Correct Form", vertical: true },
  "pushup-diamond": { id: "t2cR426fFx0", channel: "FitnessBlender", title: "Form Review: Diamond Push-Ups", vertical: true },
  "pike": { id: "0cT6ug3WVn4", channel: "SaturnoMovement", title: "The Perfect Pike Push Up!", vertical: true },
  "dips-bed": { id: "iR6EJ36dWvI", channel: "Pure Motion Fitness", title: "How to Do Bench Dips Safely (Stop Shoulder Pain!)", vertical: true },
  "fly-band": { id: "UIH0T2katdQ", channel: "Judd Lienhard", title: "Single Arm Resistance Band Chest Fly for a Deep Stretch | Judd Lienhard", vertical: true },
  "lat-raise": { id: "dlpKA2gzdEA", channel: "The Diabetes Resistance", title: "Banded Lateral Raise for Beginners #shorts", vertical: true },
  "triceps-oh": { id: "RNXjJGLfO9E", channel: "Feel Good Life with Coach Todd", title: "Exercise of the Day: Tricep Extension with Resistance Band", vertical: true },
  "row-seated": { id: "Hsxv_JPf9LQ", channel: "NeuStrength | Personal Trainer Wilmington NC", title: "Seated Resistance Band Row", vertical: true },
  "row-backpack": { id: "v18dHxciPR8", channel: "Casper Hessellund - Trainer & Athlete", title: "One arm row with hand on bench, with dumbbell - [Back Exercise]", vertical: true },
  "pulldown-kneel": { id: "nmY4MTSFln8", channel: "Digg Deep Fitness & Nutrition", title: "Lat Pulldown with Resistance Band", vertical: true },
  "pullover": { id: "10tZlKH7sKY", channel: "Novar Sports Physio", title: "Resistance Band Straight-Arm Pulldown" },
  "face-pull": { id: "EZkogN5rxug", channel: "BJ Gaddour", title: "How To Do Face Pulls with Resistance Bands To Relieve Shoulder Pain #Shorts", vertical: true },
  "pull-apart": { id: "qi2y-eI_kuI", channel: "Luke Selway | Strength Coaching Online", title: "How to do a Band Pull Apart", vertical: true },
  "curl": { id: "NJCUvjQqKnQ", channel: "Feel Good Life with Coach Todd", title: "Exercise of the Day: Bicep Curl with Resistance Band", vertical: true },
  "hammer": { id: "2Zrmupn6kjg", channel: "Clench Fitness", title: "Resistance Band Hammer Curl" },
  "lunge": { id: "ufjvjxrGyFM", channel: "DEYOFIT", title: "How to Perform a Reverse Lunge (Proper Form)", vertical: true },
  "lunge-bulgare": { id: "or1frhkjBDc", channel: "Andrew Kwong (DeltaBolic)", title: "Bulgarian Split Squat Setup & Form Tips (DO THIS!)", vertical: true },
  "box-squat": { id: "1mnoBRqivGw", channel: "Optimize Chiropractic", title: "Goblet Squat to Bench", vertical: true },
  "calf": { id: "S3jZdTw08ts", channel: "NK Active", title: "Exercise Bites: Single Leg Calf Raise", vertical: true },
  "hip-thrust": { id: "LsAaDpsLZ70", channel: "LiveLighter", title: "Cosy Couch Exercise - Hip Thrusts", vertical: true },
  "hip-thrust-uni": { id: "nOBGqh44dGM", channel: "Side Quest Fitness", title: "Bodyweight Single Leg Hip Thrust" },
  "leg-curl": { id: "xmfm6Ow5R3U", channel: "Mountain Goat Strength & Endurance", title: "Band Lying Hamstring Curls", vertical: true },
  "rdl": { id: "kClYv6Qil8M", channel: "Strong Band", title: "Banded Romanian Deadlift Tutorial | Strong Band", vertical: true },
  "rdl-uni": { id: "3ed_5PmwLMU", channel: "Horton Barbell", title: "Single Leg DB RDL (Exercise Library)" },
  "crunch-band": { id: "xx5fM5rOxtk", channel: "Girls Gone Strong | Women's Health & Fitness", title: "Kneeling Band (or Cable) Crunch", vertical: true },
  "plank": { id: "6xWUlLvltvQ", channel: "FitnessBlender", title: "Forearm Plank Form Reminders", vertical: true },
  "leg-raise": { id: "FijNSgahpz0", channel: "Calum Morrison Fitness", title: "HOW TO: Lying Leg Raises", vertical: true },
  "side-plank": { id: "BNPC_vb3E7w", channel: "35 Day Detox Yoga with Suz", title: "How to Do Forearm Side Plank | Build Core Strength & Shoulder Stability", vertical: true },
  "dead-bug": { id: "kSYl6XOzQ5U", channel: "SOS Physiotherapy", title: "Dead Bug Exercise Demonstration", vertical: true },
  "hollow": { id: "0U1ItXvKR6k", channel: "Chris Ryan Fitness", title: "Beginner Core Strength — Bent Knee Hollow Hold! 🔥", vertical: true },
  "march": { id: "zDMUQ63YdbE", channel: "Travis Tarrant", title: "Exercise Tutorial: High Knee Walk" },
  "arm-circles": { id: "tYo5ghpLksg", channel: "AJ Channels Fitness", title: "Dynamic Warm-Up Exercise: Big Arm Circles (30 Secs)" },
  "cat-cow": { id: "IPEXJ4FHDXQ", channel: "RangeMaster Range-of-Motion", title: "How to do the Cat Cow Stretch" },
  "scap-pushup": { id: "LeMk15TN0No", channel: "Children's Hospital Colorado", title: "Exercise With an Athletic Trainer: Scapular Pushups" },
  "inchworm": { id: "9UPNa7mbhqA", channel: "Horton Barbell", title: "Inchworms (Exercise Library)" },
  "glute-bridge": { id: "wPM8icPu6H8", channel: "Well+Good", title: "How To Do A Glute Bridge | The Right Way | Well+Good" },
  "clamshell": { id: "gFyIjunfbbg", channel: "Hinge Health", title: "How to Do the Clamshell Exercise" },
  "tke": { id: "Q6JjgU2aNj0", channel: "Horton Barbell", title: "TKEs (Terminal Knee Extensions) (Exercise Library)" },
  "tib-raise": { id: "dnxy5DhY0Ks", channel: "Wellth Coaching", title: "Tibialis Raise (Against Wall)" },
  "wall-sit": { id: "JaZNYM3zAP0", channel: "Well+Good", title: "How To Do a Wall Sit | The Right Way | Well+Good" },
  "bw-squat": { id: "DlS-GAF8Edg", channel: "Get Healthy U - with Chris Freytag", title: "How To Do A Proper Squat (Bodyweight)" },
  "shadow-box": { id: "TuTw9Ur4O-o", channel: "Cassie B", title: "Shadow Box: Jab Cross" },
  "step-jack": { id: "1FkE7RdRpVQ", channel: "Train With Cuz", title: "Step Jacks – Low-Impact Cardio & Coordination" },
  "climber": { id: "rte-AzwLcUw", channel: "Medbridge", title: "How to Do a Slow Mountain Climber | Medbridge" },
  "st-pecs": { id: "bZ-eaBPOGiM", channel: "Wellen", title: "How to do Doorway Pec Stretch - Flexibility - Wellen" },
  "st-child": { id: "jaCOZJPSy2g", channel: "BrettLarkinYoga", title: "How to Do Child's Pose Stretch Properly for Yoga Beginners" },
  "st-quad": { id: "1qlN5EXFUNo", channel: "Leap Fitness", title: "How to Do: QUAD STRETCH WITH WALL" },
  "st-hams": { id: "fsoVjHgdrn4", channel: "Fitway - Workout Trainer", title: "How To Do: Hamstrings - Sitting Legs Straight | Stretch Workout Exercise" },
  "st-hip": { id: "iZ1eZBY4fwM", channel: "PureGym", title: "How To Do Kneeling Lunge (Hip Flexor Stretch)" },
  "st-knees": { id: "LugNxxfIdvo", channel: "Baptist Health", title: "Double Knee to Chest" },
  "st-fig4": { id: "kdqyCSW1AN0", channel: "Kirsten McCormick", title: "Supine Pigeon Stretch or Supine Figure Four - A Piriformis and Hip External Rotator Stretch" },
  "st-squat": { id: "0wzrgyAurT8", channel: "Strength Side", title: "How to Deep Squat Hold" },
  "st-calf": { id: "YTYQo4WvJHA", channel: "Travis Tarrant", title: "Stretch Tutorial: Standing Calf Stretch On Wall" },
  "st-fold": { id: "Y42pe9JuZMQ", channel: "Yoga 15 with Abi", title: "Ragdoll" },
  "st-side": { id: "fHyCshP7U1Y", channel: "Leap Fitness", title: "How to Do：STANDING SIDE BEND" },
  "st-cross": { id: "uNmWSg705JA", channel: "BluePhoenix Fitness", title: "How To Do A Cross Body Shoulder Stretch | BluePhoenixFitness.com" },
  "pull-apart-warm": { id: "smSSXITNpCI", channel: "Rogue Fitness", title: "How To Do Band Pull Aparts" },
}
