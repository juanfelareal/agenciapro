import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { searchAPI } from '../utils/api';
import {
  Search,
  X,
  CheckSquare,
  FolderKanban,
  Users,
  User,
  FileText,
  ArrowRight,
} from 'lucide-react';

const GlobalSearch = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const typeIcons = {
    task: CheckSquare,
    project: FolderKanban,
    client: Users,
    team: User,
    invoice: FileText
  };

  const typeLabels = {
    tasks: 'Tareas',
    projects: 'Proyectos',
    clients: 'Clientes',
    team: 'Equipo',
    invoices: 'Facturas'
  };

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await searchAPI.search(query);
        setResults(response.data);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Get flat list of results for keyboard navigation
  const getFlatResults = useCallback(() => {
    if (!results || !results.results) return [];
    const flat = [];
    Object.entries(results.results).forEach(([, items]) => {
      items.forEach(item => {
        flat.push(item);
      });
    });
    return flat;
  }, [results]);

  // Keyboard navigation in input
  const handleInputKeyDown = (e) => {
    const flatResults = getFlatResults();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatResults.length > 0) {
        setSelectedIndex(prev => (prev + 1) % flatResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatResults.length > 0) {
        setSelectedIndex(prev => (prev - 1 + flatResults.length) % flatResults.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = flatResults[selectedIndex];
      if (selected) {
        handleSelect(selected);
      }
    }
  };

  const handleSelect = (item) => {
    setIsOpen(false);
    navigate(item.url);
  };

  const renderResults = () => {
    if (!results || !results.results) return null;

    let currentIndex = 0;
    const groupedResults = [];

    Object.entries(results.results).forEach(([type, items]) => {
      if (items && items.length > 0) {
        const Icon = typeIcons[items[0]?.type] || Search;

        groupedResults.push(
          <div key={type} className="py-2">
            <h4 className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase">
              {typeLabels[type]}
            </h4>
            <div>
              {items.map((item, idx) => {
                const flatIndex = currentIndex + idx;
                const isSelected = flatIndex === selectedIndex;

                return (
                  <button
                    key={`${type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(flatIndex)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} className={isSelected ? 'text-blue-500' : 'text-gray-400'} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isSelected ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {item.name}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                      )}
                    </div>
                    {item.status && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        item.status === 'active' || item.status === 'in_progress' || item.status === 'done' || item.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'pending' || item.status === 'todo' || item.status === 'draft'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {item.status}
                      </span>
                    )}
                    {isSelected && <ArrowRight size={14} className="text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
        currentIndex += items.length;
      }
    });

    if (groupedResults.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-gray-500">No se encontraron resultados</p>
          <p className="text-sm text-gray-400 mt-1">Intenta con otros términos</p>
        </div>
      );
    }

    return groupedResults;
  };

  // Modal content to be rendered via portal
  const modalContent = isOpen ? (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '100px',
        paddingLeft: '16px',
        paddingRight: '16px',
        zIndex: 99999,
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '512px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <Search size={20} color="#9ca3af" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar tareas, proyectos, clientes..."
            style={{
              flex: 1,
              fontSize: '16px',
              outline: 'none',
              border: 'none',
              backgroundColor: 'transparent',
            }}
            autoComplete="off"
            autoFocus
          />
          <button
            onClick={() => setIsOpen(false)}
            style={{
              padding: '6px',
              color: '#9ca3af',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '6px',
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{
                display: 'inline-block',
                width: '24px',
                height: '24px',
                border: '2px solid #3b82f6',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>Buscando...</p>
            </div>
          ) : query.length < 2 ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <Search size={32} color="#d1d5db" style={{ margin: '0 auto 8px' }} />
              <p style={{ color: '#6b7280' }}>Escribe al menos 2 caracteres</p>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '4px' }}>
                Busca en tareas, proyectos, clientes, equipo y facturas
              </p>
            </div>
          ) : (
            renderResults()
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '12px',
          color: '#6b7280',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <kbd style={{
              padding: '2px 6px',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontFamily: 'monospace',
            }}>↑↓</kbd>
            navegar
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <kbd style={{
              padding: '2px 6px',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontFamily: 'monospace',
            }}>↵</kbd>
            seleccionar
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <kbd style={{
              padding: '2px 6px',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontFamily: 'monospace',
            }}>esc</kbd>
            cerrar
          </span>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  ) : null;

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <Search size={16} />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-white rounded border border-gray-200">
          ⌘K
        </kbd>
      </button>

      {/* Render modal via portal to document.body */}
      {createPortal(modalContent, document.body)}
    </>
  );
};

export default GlobalSearch;
