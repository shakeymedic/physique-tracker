/**
 * Built-in mobility routines.
 * Using unicode for apostrophes to avoid JSX issues.
 */
export const ROUTINES = [
  {
    id: 'daily-10min',
    name: '10-Minute Daily Mobility',
    description: 'A quick full-body routine.',
    durationMin: 10,
    stretches: [
      { stretch: 'Cat-cow', durationSec: 60 },
      { stretch: 'World\u2019s greatest stretch', durationSec: 60 },
      { stretch: 'Hip flexor stretch (kneeling)', durationSec: 60 },
      { stretch: 'Pigeon pose', durationSec: 60 },
      { stretch: 'Hamstring stretch (seated)', durationSec: 60 },
      { stretch: 'Thoracic spine rotation', durationSec: 60 },
      { stretch: 'Doorway chest stretch', durationSec: 60 },
      { stretch: 'Calf stretch (wall)', durationSec: 60 },
      { stretch: 'Child\u2019s pose', durationSec: 60 },
      { stretch: 'Shoulder rolls', durationSec: 60 },
    ],
  },
  {
    id: 'pre-lift-warmup',
    name: 'Pre-Lift Dynamic Warmup',
    description: 'Get ready to lift heavy.',
    durationMin: 5,
    stretches: [
      { stretch: 'Hip circles', durationSec: 30 },
      { stretch: 'Ankle circles', durationSec: 30 },
      { stretch: 'Cat-cow', durationSec: 30 },
      { stretch: 'World\u2019s greatest stretch', durationSec: 60 },
      { stretch: 'Glute bridge', durationSec: 30 },
      { stretch: 'Thoracic spine rotation', durationSec: 30 },
      { stretch: 'Dead hang', durationSec: 30 },
      { stretch: 'Shoulder rolls', durationSec: 30 },
    ],
  },
  {
    id: 'hip-openers',
    name: 'Hip Openers',
    description: 'Counter the desk job / long shifts.',
    durationMin: 8,
    stretches: [
      { stretch: 'Pigeon pose', durationSec: 90 },
      { stretch: 'Couch stretch', durationSec: 90 },
      { stretch: 'Hip flexor stretch (kneeling)', durationSec: 60 },
      { stretch: 'Glute bridge', durationSec: 30 },
      { stretch: 'World\u2019s greatest stretch', durationSec: 60 },
    ],
  },
  {
    id: 'desk-recovery',
    name: 'Desk Recovery',
    description: 'For after long shifts or computer work.',
    durationMin: 6,
    stretches: [
      { stretch: 'Neck rolls', durationSec: 30 },
      { stretch: 'Shoulder rolls', durationSec: 30 },
      { stretch: 'Doorway chest stretch', durationSec: 60 },
      { stretch: 'Lat stretch (overhead reach)', durationSec: 60 },
      { stretch: 'Thoracic spine rotation', durationSec: 60 },
      { stretch: 'Cat-cow', durationSec: 60 },
      { stretch: 'Child\u2019s pose', durationSec: 60 },
    ],
  },
  {
    id: 'bedtime-wind-down',
    name: 'Bedtime Wind-Down',
    description: 'Slow, grounding stretches before sleep.',
    durationMin: 8,
    stretches: [
      { stretch: 'Child\u2019s pose', durationSec: 90 },
      { stretch: 'Pigeon pose', durationSec: 90 },
      { stretch: 'Cat-cow', durationSec: 60 },
      { stretch: 'Cobra', durationSec: 30 },
      { stretch: 'Hamstring stretch (seated)', durationSec: 60 },
      { stretch: 'Glute bridge', durationSec: 30 },
    ],
  },
]
