/**
 * BarcodeScanner — html5-qrcode camera barcode scanner modal.
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   onResult: ({ name, kcal, protein, carbs, fat, barcode }) => void
 */
import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { lookupBarcode, scaleMacros } from '../lib/openfoodfacts.js'
import { X, ScanLine, Barcode } from 'lucide-react'

const SCANNER_ID = 'barcode-scanner-region'

export default function BarcodeScanner({ open, onClose, onResult }) {
  const [status, setStatus] = useState('idle') // idle | scanning | looking_up | done | error
  const [error, setError] = useState('')
  const [product, setProduct] = useState(null) // { name, kcalPer100g, ... }
  const [barcode, setBarcode] = useState('')
  const [portion, setPortion] = useState(100)
  const [manualBarcode, setManualBarcode] = useState('')
  const [useManual, setUseManual] = useState(false)
  const scannerRef = useRef(null)

  // Start/stop scanner
  useEffect(() => {
    if (!open || useManual) return
    let scanner

    const start = async () => {
      try {
        scanner = new Html5Qrcode(SCANNER_ID)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 160 } },
          async (decodedText) => {
            await scanner.stop().catch(() => {})
            scannerRef.current = null
            setStatus('looking_up')
            await handleBarcode(decodedText)
          },
          () => {} // quiet errors during scan
        )
        setStatus('scanning')
        setError('')
      } catch (e) {
        if (e.toString().includes('permission') || e.toString().includes('Permission')) {
          setError('Camera permission denied. Use manual barcode entry below.')
          setUseManual(true)
        } else {
          setError('Could not start camera: ' + e.message)
        }
        setStatus('error')
      }
    }

    start()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [open, useManual])

  const handleBarcode = async (code) => {
    setBarcode(code)
    setError('')
    try {
      const p = await lookupBarcode(code)
      setProduct(p)
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  const handleManualLookup = async () => {
    if (!manualBarcode.trim()) return
    setStatus('looking_up')
    setError('')
    await handleBarcode(manualBarcode.trim())
  }

  const confirmProduct = () => {
    if (!product) return
    const macros = scaleMacros(product, portion)
    onResult({
      name: product.name,
      kcal: macros.kcal,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      barcode,
    })
    reset()
    onClose()
  }

  const reset = () => {
    setStatus('idle')
    setError('')
    setProduct(null)
    setBarcode('')
    setPortion(100)
    setManualBarcode('')
    setUseManual(false)
  }

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    reset()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div className="bg-surface rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-semibold text-text">
            <ScanLine size={18} className="text-accent"/>
            Scan Barcode
          </div>
          <button onClick={handleClose} className="btn-ghost p-1"><X size={18}/></button>
        </div>

        {/* Camera view */}
        {!useManual && status !== 'done' && (
          <div className="mb-3">
            <div id={SCANNER_ID} className="rounded-xl overflow-hidden bg-bg w-full" style={{ minHeight: 200 }}/>
            {status === 'scanning' && (
              <p className="text-xs text-muted text-center mt-2">Point camera at barcode (EAN-13 / UPC-A)</p>
            )}
            {status === 'looking_up' && (
              <p className="text-xs text-accent text-center mt-2 animate-pulse">Looking up product…</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2 mb-3">{error}</div>
        )}

        {/* Manual fallback */}
        {(useManual || status === 'error') && status !== 'done' && (
          <div className="mb-3">
            <p className="text-xs text-muted mb-2">Enter barcode manually:</p>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="e.g. 5000112548167"
                value={manualBarcode}
                onChange={e => setManualBarcode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualLookup()}
              />
              <button onClick={handleManualLookup} className="btn-primary" disabled={status === 'looking_up'}>
                {status === 'looking_up' ? '…' : 'Look up'}
              </button>
            </div>
            {!useManual && (
              <button onClick={() => setUseManual(true)} className="text-xs text-accent mt-2 underline">
                Use manual entry instead
              </button>
            )}
          </div>
        )}

        {!useManual && status === 'scanning' && (
          <button onClick={() => {
            if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null }
            setUseManual(true); setStatus('idle')
          }} className="btn-ghost text-xs mb-3">
            <Barcode size={14}/> Enter barcode manually instead
          </button>
        )}

        {/* Product found */}
        {status === 'done' && product && (
          <div className="space-y-3">
            <div className="bg-bg rounded-xl p-3">
              <div className="font-medium text-text mb-1">{product.name}</div>
              <div className="text-xs text-muted">per 100g: {product.kcalPer100g} kcal · P{product.proteinPer100g}g · C{product.carbsPer100g}g · F{product.fatPer100g}g</div>
            </div>
            <div>
              <label className="label">Portion size (g)</label>
              <input
                type="number"
                min="1"
                step="5"
                className="input"
                value={portion}
                onChange={e => setPortion(parseInt(e.target.value) || 100)}
              />
            </div>
            {(() => {
              const m = scaleMacros(product, portion)
              return (
                <div className="bg-accent/10 rounded-xl p-3 text-sm">
                  <span className="text-accent font-semibold">{m.kcal} kcal</span>
                  <span className="text-muted ml-2">· P{m.protein}g · C{m.carbs}g · F{m.fat}g</span>
                </div>
              )
            })()}
            <div className="flex gap-2">
              <button onClick={confirmProduct} className="btn-primary flex-1">Add to meal log</button>
              <button onClick={reset} className="btn-secondary">Scan again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
