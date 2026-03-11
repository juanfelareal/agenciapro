import { useState, useEffect } from 'react';
import { X, Search, Users, User } from 'lucide-react';
import { teamAPI, chatAPI } from '../../utils/api';

const NewConversationModal = ({ onClose, onCreated }) => {
  const [tab, setTab] = useState('direct');
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await teamAPI.getAll();
        setMembers(res.data);
      } catch (err) {
        console.error('Error loading team members:', err);
      }
    };
    loadMembers();
  }, []);

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleMember = (member) => {
    if (tab === 'direct') {
      setSelectedMembers([member]);
    } else {
      setSelectedMembers((prev) =>
        prev.find((m) => m.id === member.id)
          ? prev.filter((m) => m.id !== member.id)
          : [...prev, member]
      );
    }
  };

  const handleCreate = async () => {
    if (selectedMembers.length === 0) return;
    if (tab === 'group' && !groupName.trim()) return;

    try {
      setLoading(true);
      const res = await chatAPI.createConversation({
        type: tab,
        name: tab === 'group' ? groupName.trim() : undefined,
        member_ids: selectedMembers.map((m) => m.id),
      });
      onCreated(res.data);
      onClose();
    } catch (err) {
      console.error('Error creating conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Nueva Conversación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => { setTab('direct'); setSelectedMembers([]); }}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              tab === 'direct' ? 'text-[#1A1A2E] border-b-2 border-[#1A1A2E]' : 'text-gray-500'
            }`}
          >
            <User size={16} /> Directo
          </button>
          <button
            onClick={() => { setTab('group'); setSelectedMembers([]); }}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              tab === 'group' ? 'text-[#1A1A2E] border-b-2 border-[#1A1A2E]' : 'text-gray-500'
            }`}
          >
            <Users size={16} /> Grupo
          </button>
        </div>

        {/* Group name */}
        {tab === 'group' && (
          <div className="px-4 pt-4">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nombre del grupo"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]"
            />
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar miembro..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]"
            />
          </div>
        </div>

        {/* Selected */}
        {selectedMembers.length > 0 && (
          <div className="px-4 pt-2 flex flex-wrap gap-1">
            {selectedMembers.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 bg-[#1A1A2E] text-white text-xs px-2 py-1 rounded-full"
              >
                {m.name}
                <button onClick={() => toggleMember(m)} className="hover:text-red-300">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Members list */}
        <div className="px-4 py-3 max-h-60 overflow-y-auto">
          {filteredMembers.map((m) => {
            const selected = selectedMembers.find((s) => s.id === m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleMember(m)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selected ? 'bg-[#1A1A2E]/10' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[#1A1A2E] text-white flex items-center justify-center text-xs font-semibold">
                  {m.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <span className="flex-1 text-left">{m.name}</span>
                {selected && (
                  <span className="w-5 h-5 bg-[#1A1A2E] rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || selectedMembers.length === 0 || (tab === 'group' && !groupName.trim())}
            className="px-4 py-2 text-sm bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2A2A3E] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creando...' : tab === 'direct' ? 'Iniciar Chat' : 'Crear Grupo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewConversationModal;
