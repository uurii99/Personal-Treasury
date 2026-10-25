/**
 * Financial calculation utilities.
 * All monetary values are stored and calculated as integers (cents)
 * to avoid floating-point precision errors.
 */

/**
 * Convert euros to cents (integer).
 */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/**
 * Convert cents (integer) to euros.
 */
export function centsToEuros(cents: number): number {
  return cents / 100;
}

/**
 * Format cents as a EUR string with Spanish locale.
 * e.g. 150050 → "1.500,50 €"
 */
export function formatCurrency(cents: number): string {
  const euros = centsToEuros(cents);
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

/**
 * Format cents as a compact EUR string (no symbol).
 * e.g. 150050 → "1.500,50"
 */
export function formatAmount(cents: number): string {
  const euros = centsToEuros(cents);
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

/**
 * Format a percentage with 1 decimal place.
 * e.g. 42.5 → "42,5 %"
 */
export function formatPercentage(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/**
 * Distribute a total amount (cents) into three buckets by percentage.
 * Uses largest-remainder method to ensure the parts sum exactly to total.
 *
 * @param total - Total amount in cents
 * @param percentages - Three percentages that must sum to 100
 * @returns [fixed, leisure, savings] amounts in cents
 */
export function distributeByPercentage(
  total: number,
  percentages: [number, number, number]
): [number, number, number] {
  const [p1, p2, p3] = percentages;

  // Validate percentages sum to 100
  const sum = p1 + p2 + p3;
  if (Math.abs(sum - 100) > 0.001) {
    throw new Error(`Los porcentajes deben sumar 100%. Suma actual: ${sum}%`);
  }

  // Calculate raw amounts
  const raw1 = (total * p1) / 100;
  const raw2 = (total * p2) / 100;
  const raw3 = (total * p3) / 100;

  // Floor each amount
  const floor1 = Math.floor(raw1);
  const floor2 = Math.floor(raw2);
  const floor3 = Math.floor(raw3);

  // Calculate remainder to distribute
  const remainder = total - floor1 - floor2 - floor3;

  // Build array of [index, fractional part] for largest-remainder
  const fractions: [number, number][] = [
    [0, raw1 - floor1],
    [1, raw2 - floor2],
    [2, raw3 - floor3],
  ];

  // Sort by fractional part descending
  fractions.sort((a, b) => b[1] - a[1]);

  const result: [number, number, number] = [floor1, floor2, floor3];

  // Distribute remaining cents to largest fractions
  for (let i = 0; i < remainder; i++) {
    result[fractions[i][0]] += 1;
  }

  return result;
}

/**
 * Distribute a total amount evenly across N installments.
 * Adjusts the last installment to absorb rounding differences.
 *
 * @param total - Total amount in cents
 * @param installments - Number of installments
 * @returns Array of installment amounts in cents
 */
export function distributeAcrossInstallments(
  total: number,
  installments: number
): number[] {
  if (installments <= 0) {
    throw new Error('El número de cuotas debe ser mayor que 0');
  }

  const baseAmount = Math.floor(total / installments);
  const result = new Array(installments).fill(baseAmount);

  // Last installment absorbs the remainder
  const distributed = baseAmount * installments;
  result[installments - 1] += total - distributed;

  return result;
}

/**
 * Validate that three percentages sum to exactly 100.
 */
export function validatePercentages(
  fixed: number,
  leisure: number,
  savings: number
): { valid: boolean; error?: string } {
  if (fixed < 0 || leisure < 0 || savings < 0) {
    return { valid: false, error: 'Los porcentajes no pueden ser negativos' };
  }

  const sum = fixed + leisure + savings;
  if (Math.abs(sum - 100) > 0.01) {
    return {
      valid: false,
      error: `Los porcentajes deben sumar 100%. Suma actual: ${sum.toFixed(1)}%`,
    };
  }

  return { valid: true };
}

/**
 * Calculate budget status for a section.
 */
export function calculateBudgetStatus(
  budgetCents: number,
  spentCents: number
): {
  available: number;
  percentage: number;
  status: 'ok' | 'warning' | 'danger' | 'over';
} {
  const available = budgetCents - spentCents;
  const percentage = budgetCents > 0 ? (spentCents / budgetCents) * 100 : 0;

  let status: 'ok' | 'warning' | 'danger' | 'over';
  if (percentage > 100) {
    status = 'over';
  } else if (percentage >= 90) {
    status = 'danger';
  } else if (percentage >= 75) {
    status = 'warning';
  } else {
    status = 'ok';
  }

  return { available, percentage, status };
}

/**
 * Parse a Spanish-format amount string to cents.
 * e.g. "1.500,50" → 150050
 */
export function parseSpanishAmount(input: string): number | null {
  if (!input || input.trim() === '') return null;

  // Remove currency symbol and whitespace
  let cleaned = input.replace(/[€\s]/g, '').trim();

  // Handle Spanish format: 1.500,50 → 1500.50
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;

  return eurosToCents(parsed);
}
