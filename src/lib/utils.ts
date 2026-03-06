/**
 * Format price in Japanese Yen
 * @example formatPrice(5000) => "5,000"
 */
export function formatPrice(price: number): string {
  return price.toLocaleString('ja-JP')
}

/**
 * Merge class names, filtering out falsy values
 * Simple utility — no external dependency needed
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

