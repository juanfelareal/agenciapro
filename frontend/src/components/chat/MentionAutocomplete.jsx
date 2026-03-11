import { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../../utils/api';

const MentionAutocomplete = ({ query, onSelect, onClose, position }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await chatAPI.searchEntities(query);
        setResults(res.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!query || results.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-1 left-0 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto"
      style={position}
    >
      {loading ? (
        <div className="p-3 text-sm text-gray-500">Buscando...</div>
      ) : (
        results.map((item) => (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => onSelect(item)}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
          >
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              item.type === 'task' ? 'bg-blue-100 text-blue-700'
                : item.type === 'note' ? 'bg-amber-100 text-amber-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              {item.type === 'task' ? '#T' : item.type === 'note' ? '#N' : '#P'}
            </span>
            <span className="truncate">{item.title}</span>
          </button>
        ))
      )}
    </div>
  );
};

export default MentionAutocomplete;
