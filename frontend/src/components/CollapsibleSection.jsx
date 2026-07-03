import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function CollapsibleSection({
  id,
  title,
  icon: Icon,
  iconBg = 'bg-gray-100',
  iconColor = 'text-gray-600',
  defaultOpen = false,
  children,
}) {
  const storageKey = id ? `metrics-section-${id}` : null;
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen;
    const saved = localStorage.getItem(storageKey);
    if (saved === null) return defaultOpen;
    return saved === 'true';
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (storageKey) localStorage.setItem(storageKey, String(next));
  };

  return (
    <div className="glass rounded-xl mb-6 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
          )}
          <h2 className="text-lg font-semibold text-[#17181A]">{title}</h2>
        </div>
        {open ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}
