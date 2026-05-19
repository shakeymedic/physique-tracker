/**
 * Open Food Facts API helper
 */

const BASE = 'https://world.openfoodfacts.org/api/v2/product'

/**
 * Look up a product by barcode.
 * Returns { name, kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g } or throws.
 */
export async function lookupBarcode(barcode) {
  const res = await fetch(`${BASE}/${barcode}.json?fields=product_name,nutriments`)
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`)
  const data = await res.json()
  if (data.status !== 1 || !data.product) {
    throw new Error('Product not found in Open Food Facts database')
  }
  const p = data.product
  const n = p.nutriments || {}
  return {
    name: p.product_name || 'Unknown product',
    kcalPer100g: parseFloat(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
    proteinPer100g: parseFloat(n['proteins_100g'] ?? n['proteins'] ?? 0),
    carbsPer100g: parseFloat(n['carbohydrates_100g'] ?? n['carbohydrates'] ?? 0),
    fatPer100g: parseFloat(n['fat_100g'] ?? n['fat'] ?? 0),
  }
}

/**
 * Scale macro values by portion size.
 * @param {object} per100g - { kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g }
 * @param {number} portionG - portion size in grams
 * @returns {{ kcal, protein, carbs, fat }}
 */
export function scaleMacros(per100g, portionG) {
  const factor = portionG / 100
  return {
    kcal: Math.round(per100g.kcalPer100g * factor),
    protein: Math.round(per100g.proteinPer100g * factor * 10) / 10,
    carbs: Math.round(per100g.carbsPer100g * factor * 10) / 10,
    fat: Math.round(per100g.fatPer100g * factor * 10) / 10,
  }
}
