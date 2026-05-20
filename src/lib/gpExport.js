/**
 * GP Export — generates a 3-month health summary PDF using jspdf.
 * Covers: weight trend, blood results, medications, training summary.
 */
import { jsPDF } from 'jspdf'
import { format } from 'date-fns'

function safeVal(v, dec = 1) {
  const n = parseFloat(v)
  return isNaN(n) ? '—' : n.toFixed(dec)
}

export async function generateGpExport({ weights, bloods, medications, medicationLog, lifts, cardio, settings, name }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const margin = 18
  const contentW = pageW - margin * 2
  let y = 20

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = format(cutoff, 'yyyy-MM-dd')
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // ── Header ──
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setTextColor(34, 211, 238)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Health Summary Report', margin, 13)
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${todayStr}  ·  Period: ${cutoffStr} – ${todayStr}`, margin, 21)
  if (name) doc.text(`Patient: ${name}`, pageW - margin, 21, { align: 'right' })

  y = 36

  // ── Helper: Section heading ──
  const sectionHead = (title) => {
    doc.setFillColor(30, 41, 59)
    doc.rect(margin, y, contentW, 7, 'F')
    doc.setTextColor(34, 211, 238)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 3, y + 5)
    y += 10
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
  }

  const checkPage = (need = 20) => {
    if (y + need > 272) { doc.addPage(); y = 20 }
  }

  // ── 1. Weight Summary ──
  const recentWeights = weights.filter(w => w.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date))
  if (recentWeights.length > 0) {
    sectionHead('Weight & Body Composition (last 90 days)')
    const first = recentWeights[0]
    const last = recentWeights[recentWeights.length - 1]
    const change = (parseFloat(last.weight) - parseFloat(first.weight)).toFixed(1)
    const profile = settings?.profile || {}

    doc.setTextColor(51, 65, 85)
    doc.text(`Readings: ${recentWeights.length}  ·  Start: ${safeVal(first.weight, 1)} kg (${first.date})  ·  Current: ${safeVal(last.weight, 1)} kg (${last.date})  ·  Change: ${parseFloat(change) >= 0 ? '+' : ''}${change} kg`, margin, y)
    y += 5
    if (last.bodyFat) {
      const lbm = (parseFloat(last.weight) * (1 - parseFloat(last.bodyFat) / 100)).toFixed(1)
      doc.text(`Body fat: ${safeVal(last.bodyFat, 1)}%  ·  Lean body mass: ${lbm} kg`, margin, y)
      y += 5
    }
    if (profile.height) {
      const bmi = (parseFloat(last.weight) / Math.pow(parseFloat(profile.height) / 100, 2)).toFixed(1)
      doc.text(`BMI: ${bmi} (height ${profile.height} cm)`, margin, y)
      y += 5
    }

    // Mini weight table (every 2 weeks)
    y += 2
    const tableWeights = recentWeights.filter((_, i) => i === 0 || i === recentWeights.length - 1 || i % Math.max(1, Math.floor(recentWeights.length / 8)) === 0)
    doc.setFillColor(241, 245, 249)
    doc.rect(margin, y, contentW, 5, 'F')
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'bold')
    doc.text('Date', margin + 2, y + 3.5)
    doc.text('Weight (kg)', margin + 40, y + 3.5)
    doc.text('Body Fat %', margin + 80, y + 3.5)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    tableWeights.forEach(w => {
      checkPage(6)
      doc.text(w.date, margin + 2, y + 3.5)
      doc.text(safeVal(w.weight, 1), margin + 40, y + 3.5)
      doc.text(w.bodyFat ? safeVal(w.bodyFat, 1) : '—', margin + 80, y + 3.5)
      y += 5.5
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, y, margin + contentW, y)
    })
    y += 6
  }

  // ── 2. Blood Results ──
  const recentBloods = bloods.filter(b => b.date >= cutoffStr).sort((a, b) => b.date.localeCompare(a.date))
  if (recentBloods.length > 0) {
    checkPage(40)
    sectionHead('Blood Results (last 90 days)')

    const BLOOD_LABELS = {
      systolic: 'Systolic BP (mmHg)', diastolic: 'Diastolic BP (mmHg)', hr: 'Heart rate (bpm)',
      glucose: 'Glucose (mmol/L)', totalCholesterol: 'Total cholesterol (mmol/L)',
      ldl: 'LDL (mmol/L)', hdl: 'HDL (mmol/L)', triglycerides: 'Triglycerides (mmol/L)',
      haemoglobin: 'Haemoglobin (g/dL)', ferritin: 'Ferritin (µg/L)',
      vitD: 'Vitamin D (nmol/L)', b12: 'Vitamin B12 (pmol/L)',
      creatinine: 'Creatinine (µmol/L)', alt: 'ALT (U/L)', tsh: 'TSH (mU/L)',
      testosterone: 'Testosterone (nmol/L)',
    }

    const mostRecent = recentBloods[0]
    const prev = recentBloods[1]
    doc.text(`Most recent: ${mostRecent.date}${prev ? `  ·  Previous: ${prev.date}` : ''}`, margin, y)
    y += 7

    doc.setFillColor(241, 245, 249)
    doc.rect(margin, y, contentW, 5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('Parameter', margin + 2, y + 3.5)
    doc.text('Value', margin + 80, y + 3.5)
    doc.text('Previous', margin + 110, y + 3.5)
    doc.text('Change', margin + 140, y + 3.5)
    y += 6
    doc.setFont('helvetica', 'normal')

    Object.entries(BLOOD_LABELS).forEach(([key, label]) => {
      const cur = parseFloat(mostRecent[key])
      const pre = prev ? parseFloat(prev[key]) : NaN
      if (isNaN(cur)) return
      checkPage(6)
      doc.setTextColor(15, 23, 42)
      doc.text(label, margin + 2, y + 3.5)
      doc.text(safeVal(cur, 1), margin + 80, y + 3.5)
      doc.text(!isNaN(pre) ? safeVal(pre, 1) : '—', margin + 110, y + 3.5)
      if (!isNaN(pre) && !isNaN(cur)) {
        const delta = (cur - pre).toFixed(1)
        doc.setTextColor(parseFloat(delta) === 0 ? 100 : parseFloat(delta) > 0 ? 220 : 5)
        doc.text(`${parseFloat(delta) > 0 ? '+' : ''}${delta}`, margin + 140, y + 3.5)
        doc.setTextColor(15, 23, 42)
      }
      y += 5.5
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, y, margin + contentW, y)
    })
    y += 6
  }

  // ── 3. Medications ──
  if (medications?.length > 0) {
    checkPage(30)
    sectionHead('Current Medications')

    medications.forEach(med => {
      checkPage(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(`${med.name} ${med.dose}${med.unit}`, margin + 2, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(`${med.frequency} · ${med.indication || ''}`, margin + 80, y)
      y += 6

      // Adherence in last 90 days
      const taken = (medicationLog || []).filter(l => l.medId === med.id && l.date >= cutoffStr && !l.outOfSchedule)
      if (taken.length > 0) {
        doc.text(`Doses taken in period: ${taken.length}  ·  Last: ${taken.sort((a, b) => b.date.localeCompare(a.date))[0]?.date}`, margin + 4, y)
        y += 5
      }
    })
    y += 3
  }

  // ── 4. Training Summary ──
  const recentLifts = lifts.filter(l => l.date >= cutoffStr)
  const recentCardio = cardio.filter(c => c.date >= cutoffStr)
  if (recentLifts.length > 0 || recentCardio.length > 0) {
    checkPage(30)
    sectionHead('Training Summary (last 90 days)')

    if (recentLifts.length > 0) {
      const totalTonnage = recentLifts.reduce((acc, l) => acc + (parseFloat(l.totalTonnage) || 0), 0)
      const prs = recentLifts.flatMap(l => l.prs || [])
      const uniquePRs = [...new Set(prs)]
      doc.text(`Gym sessions: ${recentLifts.length}  ·  Total tonnage: ${(totalTonnage / 1000).toFixed(1)}t`, margin, y)
      y += 5
      if (uniquePRs.length > 0) {
        doc.setTextColor(34, 211, 238)
        doc.text(`PRs achieved: ${uniquePRs.join(', ')}`, margin, y)
        doc.setTextColor(15, 23, 42)
        y += 5
      }
    }
    if (recentCardio.length > 0) {
      const totalKm = recentCardio.reduce((a, c) => a + (parseFloat(c.distanceKm) || 0), 0)
      const totalMin = recentCardio.reduce((a, c) => a + (parseFloat(c.durationMin) || 0), 0)
      const totalKcal = recentCardio.reduce((a, c) => a + (parseFloat(c.kcal) || 0), 0)
      doc.text(`Cardio sessions: ${recentCardio.length}  ·  ${totalKm > 0 ? `Distance: ${totalKm.toFixed(1)} km  ·  ` : ''}Duration: ${Math.round(totalMin)} min${totalKcal > 0 ? `  ·  ${Math.round(totalKcal)} kcal burned` : ''}`, margin, y)
      y += 5
    }
  }

  // ── Footer ──
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(`Physique Tracker · ${todayStr} · Page ${i} of ${pageCount}`, pageW / 2, 288, { align: 'center' })
    doc.text('Generated for personal health monitoring. Not a substitute for professional medical advice.', pageW / 2, 292, { align: 'center' })
  }

  doc.save(`health-summary-${todayStr}.pdf`)
}
