import { useSyncExternalStore } from 'react';
import { getBranding, subscribeBranding, logoFor } from './applyBranding.js';

/**
 * Marca actual ya resuelta (se actualiza en vivo al llamar applyBranding).
 *
 *   const { branding, colors, org, logo } = useBranding();
 *   colors.accent / colors.accentDeep / colors.ink / colors.dark …  → hex para recharts, PDF, canvas
 *   logo('light' | 'dark' | 'sidebar' | 'icon')                      → URL del logo adecuado
 */
export function useBranding() {
  const state = useSyncExternalStore(subscribeBranding, getBranding, getBranding);
  return {
    ...state,
    logo: (context = 'light') => logoFor(context, state),
  };
}

export default useBranding;
