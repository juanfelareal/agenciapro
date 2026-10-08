import React, { useState } from 'react';
import { Info as InfoIcon } from 'lucide-react';

/**
 * Tooltip de una frase para explicar una métrica. Funciona con hover (escritorio) y tap (móvil).
 * `align` mueve la burbuja cuando el icono queda pegado a un borde.
 */
export default function Info({ text, className = '', align = 'center' }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const pos = align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return (
    <span
      className={`relative inline-flex align-middle ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Qué significa"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onBlur={() => setOpen(false)}
        className="text-gray-300 hover:text-gray-500 inline-flex transition-colors"
      >
        <InfoIcon className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-40 top-full mt-1.5 w-60 ${pos} bg-[#17181A] text-white text-[11px] leading-relaxed font-normal normal-case tracking-normal text-left rounded-lg px-3 py-2 shadow-xl pointer-events-none`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
