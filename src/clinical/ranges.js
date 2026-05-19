// UK adult blood reference ranges and flag helper
// sex: 'M' | 'F' — defaults to 'M'

export const RANGES = {
  systolic: {
    label: 'Systolic BP', unit: 'mmHg',
    M: { ok: [90, 120], warn: [120, 140] },
    F: { ok: [90, 120], warn: [120, 140] },
  },
  diastolic: {
    label: 'Diastolic BP', unit: 'mmHg',
    M: { ok: [60, 80], warn: [80, 90] },
    F: { ok: [60, 80], warn: [80, 90] },
  },
  hr: {
    label: 'Heart Rate', unit: 'bpm',
    M: { ok: [50, 100], warn: [40, 50] },
    F: { ok: [50, 100], warn: [40, 50] },
  },
  totalChol: {
    label: 'Total Cholesterol', unit: 'mmol/L',
    M: { okMax: 5.0, warnMax: 6.5 },
    F: { okMax: 5.0, warnMax: 6.5 },
  },
  hdl: {
    label: 'HDL Cholesterol', unit: 'mmol/L',
    M: { okMin: 1.0, warnMin: 0.9 },
    F: { okMin: 1.2, warnMin: 0.9 },
  },
  ldl: {
    label: 'LDL Cholesterol', unit: 'mmol/L',
    M: { okMax: 3.0, warnMax: 4.0 },
    F: { okMax: 3.0, warnMax: 4.0 },
  },
  triglycerides: {
    label: 'Triglycerides', unit: 'mmol/L',
    M: { okMax: 1.7, warnMax: 2.3 },
    F: { okMax: 1.7, warnMax: 2.3 },
  },
  ast: {
    label: 'AST', unit: 'U/L',
    M: { ok: [10, 40], warn: [41, 80] },
    F: { ok: [10, 40], warn: [41, 80] },
  },
  alt: {
    label: 'ALT', unit: 'U/L',
    M: { ok: [7, 56], warn: [57, 100] },
    F: { ok: [7, 56], warn: [57, 100] },
  },
  ggt: {
    label: 'GGT', unit: 'U/L',
    M: { ok: [8, 61], warn: [62, 120] },
    F: { ok: [8, 61], warn: [62, 120] },
  },
  alp: {
    label: 'ALP', unit: 'U/L',
    M: { ok: [44, 147], warn: [148, 250] },
    F: { ok: [44, 147], warn: [148, 250] },
  },
  bilirubin: {
    label: 'Bilirubin', unit: 'µmol/L',
    M: { ok: [3, 20], warn: [21, 40] },
    F: { ok: [3, 20], warn: [21, 40] },
  },
  haemoglobin: {
    label: 'Haemoglobin', unit: 'g/L',
    M: { ok: [130, 170] },
    F: { ok: [120, 150] },
  },
  haematocrit: {
    label: 'Haematocrit', unit: '%',
    M: { ok: [38, 52], badHigh: 54, badLow: 35 },
    F: { ok: [35, 47], badHigh: 54, badLow: 35 },
  },
  hba1c: {
    label: 'HbA1c', unit: 'mmol/mol',
    M: { okMax: 42, warnMax: 47 },
    F: { okMax: 42, warnMax: 47 },
  },
  fastingGlucose: {
    label: 'Fasting Glucose', unit: 'mmol/L',
    M: { ok: [4.0, 5.4], warn: [5.5, 6.9] },
    F: { ok: [4.0, 5.4], warn: [5.5, 6.9] },
  },
  egfr: {
    label: 'eGFR', unit: 'mL/min/1.73m²',
    M: { okMin: 90, warnMin: 60 },
    F: { okMin: 90, warnMin: 60 },
  },
  creatinine: {
    label: 'Creatinine', unit: 'µmol/L',
    M: { ok: [60, 110], badHigh: 120 },
    F: { ok: [45, 90], badHigh: 120 },
  },
}

/**
 * flag(name, value, sex) → 'ok' | 'warn' | 'bad' | null
 */
export function flag(name, value, sex = 'M') {
  if (value === null || value === undefined || value === '') return null
  const v = parseFloat(value)
  if (isNaN(v)) return null
  const r = RANGES[name]
  if (!r) return null
  const s = sex === 'F' ? 'F' : 'M'
  const ranges = r[s] || r['M']

  // okMax / warnMax (lower is better: cholesterol, hba1c, etc.)
  if (ranges.okMax !== undefined) {
    if (v < ranges.okMax) return 'ok'
    if (ranges.warnMax !== undefined && v <= ranges.warnMax) return 'warn'
    return 'bad'
  }

  // okMin / warnMin (higher is better: HDL, eGFR)
  if (ranges.okMin !== undefined) {
    if (v >= ranges.okMin) return 'ok'
    if (ranges.warnMin !== undefined && v >= ranges.warnMin) return 'warn'
    return 'bad'
  }

  // ok range with optional badHigh/badLow
  if (ranges.ok) {
    const [lo, hi] = ranges.ok
    if (v >= lo && v <= hi) return 'ok'
    // warn range
    if (ranges.warn) {
      const [wlo, whi] = ranges.warn
      if (v > hi && v <= whi) return 'warn'
      if (v < lo && v >= wlo) return 'warn'
    }
    // haematocrit / creatinine badHigh check
    if (ranges.badHigh !== undefined && v > ranges.badHigh) return 'bad'
    if (ranges.badLow !== undefined && v < ranges.badLow) return 'bad'
    return 'bad'
  }

  return null
}
