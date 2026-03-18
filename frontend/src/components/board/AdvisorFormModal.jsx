import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { boardAPI } from '../../utils/api';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#1A1A2E'];
const ICONS = ['🧠', '💼', '📊', '🎯', '💡', '🔬', '📈', '🛡️', '⚖️', '🎨', '🤝', '🏗️', '💰', '🌐', '📣'];

const slugify = (text) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const AdvisorFormModal = ({ advisor, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: advisor?.name || '',
    slug: advisor?.slug || '',
    role: advisor?.role || '',
    expertise: advisor?.expertise || '',
    icon: advisor?.icon || '🧠',
    avatar_color: advisor?.avatar_color || '#6366f1',
    system_prompt: advisor?.system_prompt || '',
    example_prompts: advisor?.example_prompts || [],
  });
  const [saving, setSaving] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [slugManual, setSlugManual] = useState(!!advisor);

  const handleNameChange = (name) => {
    setForm(prev => ({
      ...prev,
      name,
      ...(!slugManual && { slug: slugify(name) }),
    }));
  };

  const addPrompt = () => {
    if (!newPrompt.trim()) return;
    setForm(prev => ({ ...prev, example_prompts: [...prev.example_prompts, newPrompt.trim()] }));
    setNewPrompt('');
  };

  const removePrompt = (idx) => {
    setForm(prev => ({ ...prev, example_prompts: prev.example_prompts.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.role || !form.system_prompt) return;
    setSaving(true);
    try {
      let res;
      if (advisor) {
        res = await boardAPI.updateAdvisor(advisor.id, form);
      } else {
        res = await boardAPI.createAdvisor(form);
      }
      onSave(res.data);
    } catch (err) {
      console.error('Error saving advisor:', err);
      alert(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {advisor ? 'Editar Advisor' : 'Nuevo Advisor'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Icon + Color */}
          <div className="flex gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Icono</label>
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setForm(prev => ({ ...prev, icon: ic }))}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
                      form.icon === ic ? 'ring-2 ring-[#1A1A2E] bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm(prev => ({ ...prev, avatar_color: c }))}
                    className={`w-7 h-7 rounded-full transition-all ${
                      form.avatar_color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Name + Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Director Financiero"
                className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Slug (URL)</label>
              <input
                value={form.slug}
                onChange={(e) => { setSlugManual(true); setForm(prev => ({ ...prev, slug: slugify(e.target.value) })); }}
                placeholder="director-financiero"
                className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20"
              />
            </div>
          </div>

          {/* Role + Expertise */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Rol</label>
            <input
              value={form.role}
              onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
              placeholder="Ej: CFO & Estratega Financiero"
              className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Expertise (opcional)</label>
            <input
              value={form.expertise}
              onChange={(e) => setForm(prev => ({ ...prev, expertise: e.target.value }))}
              placeholder="Ej: Finanzas, pricing, inversiones, flujo de caja"
              className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">System Prompt</label>
            <textarea
              value={form.system_prompt}
              onChange={(e) => setForm(prev => ({ ...prev, system_prompt: e.target.value }))}
              placeholder="Eres un experto en finanzas corporativas con 20 anos de experiencia..."
              rows={6}
              className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 resize-y"
            />
            <p className="text-xs text-gray-400 mt-1">Define la personalidad, expertise y estilo del advisor</p>
          </div>

          {/* Example Prompts */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Preguntas de ejemplo (opcional)</label>
            <div className="space-y-2">
              {form.example_prompts.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">{p}</span>
                  <button onClick={() => removePrompt(i)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPrompt())}
                  placeholder="Agregar pregunta de ejemplo..."
                  className="flex-1 px-3 py-1.5 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20"
                />
                <button
                  onClick={addPrompt}
                  disabled={!newPrompt.trim()}
                  className="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.slug || !form.role || !form.system_prompt}
            className="px-4 py-2 bg-[#1A1A2E] text-white text-sm rounded-xl hover:bg-[#2A2A3E] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : advisor ? 'Guardar cambios' : 'Crear Advisor'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvisorFormModal;
