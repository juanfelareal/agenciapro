import React, { useEffect, useState } from 'react';
import { Loader2, Printer, X } from 'lucide-react';

/**
 * Envoltorio de las páginas de impresión: fondo blanco, barra flotante (oculta al imprimir)
 * con "Guardar como PDF" y auto-apertura del diálogo de impresión cuando los datos están listos.
 * En celular el diálogo nativo permite "Guardar como PDF" o compartir.
 */
export default function PrintShell({ loading, error, children, autoPrint = true }) {
  const [printed, setPrinted] = useState(false);
  useEffect(() => {
    if (loading || error || printed || !autoPrint) return;
    const t = setTimeout(() => {
      setPrinted(true);
      try { window.print(); } catch { /* algunos navegadores móviles no exponen print() */ }
    }, 700); // deja cargar la fuente y los SVG
    return () => clearTimeout(t);
  }, [loading, error, printed, autoPrint]);

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <style>{`
        @media print { .print-toolbar { display: none !important; } body { background: #fff; } }
        @media screen { .print-page { padding: 24px 16px 60px; } }
      `}</style>
      <div className="print-toolbar" style={{ position: 'sticky', top: 0, zIndex: 50, background: '#17181A', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
        <span>{loading ? 'Preparando el informe…' : error ? error : 'Informe listo. Usa "Guardar como PDF" en el diálogo de impresión.'}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => window.print()} disabled={loading || !!error} style={{ background: '#D7F653', color: '#17181A', border: 0, borderRadius: 10, padding: '7px 12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <Printer size={15} /> Guardar como PDF
          </button>
          <button type="button" onClick={() => (window.history.length > 1 ? window.history.back() : window.close())} style={{ background: 'transparent', color: '#fff', border: '1px solid #4B5563', borderRadius: 10, padding: '7px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <X size={15} /> Cerrar
          </button>
        </span>
      </div>
      <div className="print-page">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>{error}</div>
        ) : children}
      </div>
    </div>
  );
}
