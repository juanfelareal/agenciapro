/**
 * Formatting utilities for financial dashboard
 * IMPORTANT: Always show FULL values with thousands separators (e.g., $4,235,000)
 * NEVER abbreviate values (no $4.2M)
 */

/**
 * Format currency with full value (no abbreviation)
 * @param {number} value - The value to format
 * @param {boolean} showCents - Whether to show cents (default false)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, showCents = false) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0';
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);
};

/**
 * Format percentage
 * @param {number} value - The percentage value (e.g., 42.7)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format number with thousands separators
 * @param {number} value - The value to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('es-CO').format(value);
};

/**
 * Format multiplier (e.g., 4.2x)
 * @param {number} value - The multiplier value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted multiplier string
 */
export const formatMultiplier = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0x';
  }
  return `${value.toFixed(decimals)}x`;
};

/**
 * Get month name in Spanish
 * @param {number} month - Month number (1-12)
 * @returns {string} Month name in Spanish
 */
export const getMonthName = (month) => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month - 1] || '';
};

/**
 * Get short month name in Spanish
 * @param {number} month - Month number (1-12)
 * @returns {string} Short month name
 */
export const getMonthShort = (month) => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months[month - 1] || '';
};
