import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { scenariosLoader } from './scenariosModule';

/**
 * Punto de extensión: la pestaña "Escenarios" del dashboard financiero del portal.
 * Renderiza `components/growth/financial/ScenariosTab.jsx` SOLO si el archivo existe
 * (ver scenariosModule.js); si no, no renderiza nada.
 */
const ScenariosTab = scenariosLoader ? React.lazy(scenariosLoader) : null;

class SlotBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('ScenariosTab falló:', error); }
  render() {
    if (this.state.error) {
      return <div className="glass-solid rounded-2xl p-8 text-center text-sm text-gray-500">No pudimos cargar los escenarios por ahora.</div>;
    }
    return this.props.children;
  }
}

export default function PortalScenariosSlot(props) {
  if (!ScenariosTab) return null;
  return (
    <SlotBoundary>
      <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>}>
        <ScenariosTab {...props} />
      </Suspense>
    </SlotBoundary>
  );
}
