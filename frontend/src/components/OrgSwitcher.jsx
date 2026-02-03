import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const OrgSwitcher = () => {
  const { currentOrg, organizations, switchOrg, hasMultipleOrgs } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentOrg) return null;

  const handleSwitchOrg = async (orgId) => {
    if (orgId === currentOrg.id) {
      setIsOpen(false);
      return;
    }

    setSwitching(true);
    const result = await switchOrg(orgId);
    setSwitching(false);
    setIsOpen(false);

    if (result.success) {
      // Reload page to refresh all data with new org context
      window.location.reload();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => hasMultipleOrgs && setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-150 ${
          hasMultipleOrgs ? 'hover:bg-black/5 cursor-pointer' : 'cursor-default'
        }`}
      >
        {currentOrg.logo_url ? (
          <img src={currentOrg.logo_url} alt={currentOrg.name} className="w-5 h-5 rounded object-contain" />
        ) : (
          <Building2 size={16} className="text-ink-500" />
        )}
        <span className="font-medium text-ink-800 truncate max-w-[140px]">{currentOrg.name}</span>
        {hasMultipleOrgs && (
          <ChevronDown
            size={14}
            className={`text-ink-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && hasMultipleOrgs && (
        <div
          className="absolute left-0 top-full mt-1 w-64 py-1 rounded-xl shadow-lg border border-ink-100 z-50"
          style={{ background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(20px)' }}
        >
          <div className="px-3 py-2 text-xs font-medium text-ink-400 uppercase tracking-wider">
            Organizaciones
          </div>
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSwitchOrg(org.id)}
              disabled={switching}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-ink-50 transition-colors disabled:opacity-50"
            >
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.name} className="w-6 h-6 rounded object-contain" />
              ) : (
                <div className="w-6 h-6 rounded bg-ink-100 flex items-center justify-center">
                  <Building2 size={14} className="text-ink-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-800 truncate">{org.name}</p>
                <p className="text-xs text-ink-400">{org.role === 'admin' ? 'Admin' : org.role === 'manager' ? 'Manager' : 'Miembro'}</p>
              </div>
              {org.id === currentOrg.id && (
                <Check size={16} className="text-accent flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrgSwitcher;
