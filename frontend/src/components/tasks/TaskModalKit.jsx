import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * TaskModalKit — piezas visuales del modal de tareas (estilo Linear/Notion).
 * Todos son presentacionales: el estado vive en Tasks.jsx.
 */

/**
 * PillSelect — pill compacta con un <select> nativo invisible encima.
 * Mantiene accesibilidad y comportamiento nativo (teclado, mobile) sin
 * lógica de dropdown propia.
 *
 * tone: 'neutral' | 'nudge' (ámbar punteado para campos vacíos que dan orden)
 */
export function PillSelect({ icon: Icon, dot, label, value, onChange, options, tone = 'neutral', title, maxWidth = 'max-w-[160px]' }) {
  const toneClasses =
    tone === 'nudge'
      ? 'border-dashed border-amber-300 bg-amber-50/60 text-amber-700 hover:bg-amber-50'
      : 'border-gray-200 bg-white text-[#1A1A2E] hover:border-gray-300 hover:bg-gray-50';

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 h-9 pl-3 pr-2.5 rounded-lg border text-[13px] font-medium cursor-pointer transition-colors select-none ${toneClasses}`}
      title={title}
    >
      {dot && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />}
      {Icon && <Icon size={14} className="flex-shrink-0 opacity-60" />}
      <span className={`truncate ${maxWidth}`}>{label}</span>
      <ChevronDown size={13} className="flex-shrink-0 opacity-40" />
      <select
        value={value}
        onChange={onChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * DatePill — igual que PillSelect pero con <input type="date"> invisible.
 */
export function DatePill({ icon: Icon, label, value, onChange, tone = 'neutral', title }) {
  const toneClasses =
    tone === 'nudge'
      ? 'border-dashed border-amber-300 bg-amber-50/60 text-amber-700 hover:bg-amber-50'
      : 'border-gray-200 bg-white text-[#1A1A2E] hover:border-gray-300 hover:bg-gray-50';

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 h-9 pl-3 pr-2.5 rounded-lg border text-[13px] font-medium cursor-pointer transition-colors select-none ${toneClasses}`}
      title={title}
    >
      {Icon && <Icon size={14} className="flex-shrink-0 opacity-60" />}
      <span className="truncate">{label}</span>
      <input
        type="date"
        value={value}
        onChange={onChange}
        onClick={(e) => {
          try { e.currentTarget.showPicker?.(); } catch { /* Safari fallback: focus nativo */ }
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}

/**
 * Toggle — switch premium (knob lima sobre navy cuando está activo).
 */
export function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-[22px] rounded-full flex-shrink-0 transition-colors duration-200 ${
        checked ? 'bg-[#1A1A2E]' : 'bg-gray-200'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full shadow-sm transition-all duration-200 ${
          checked ? 'translate-x-[14px] bg-[#BFFF00]' : 'translate-x-0 bg-white'
        }`}
      />
    </button>
  );
}

/**
 * ToggleRow — fila etiqueta + descripción + switch a la derecha.
 */
export function ToggleRow({ icon: Icon, label, hint, checked, onChange, disabled = false, children }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${checked ? 'bg-[#1A1A2E] text-[#BFFF00]' : 'bg-gray-100 text-gray-400'} transition-colors`}>
            <Icon size={15} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1A1A2E]">{label}</p>
          {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
      {children}
    </div>
  );
}

/**
 * Section — grupo colapsable con encabezado sobrio.
 * badge: texto corto opcional a la derecha del título (ej: conteo).
 */
export function Section({ icon: Icon, title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-gray-50/80 transition-colors text-left"
      >
        <ChevronRight
          size={15}
          className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        {Icon && <Icon size={15} className="text-gray-400 flex-shrink-0" />}
        <span className="text-[13px] font-semibold text-[#1A1A2E] tracking-wide">{title}</span>
        {badge && (
          <span className="ml-auto text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}
