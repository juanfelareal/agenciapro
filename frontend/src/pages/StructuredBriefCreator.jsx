import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { structuredBriefsAPI, clientsAPI, teamAPI } from '../utils/api';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Rocket,
  ChevronDown,
  ChevronUp,
  GripVertical,
  User,
  Calendar,
  AlertTriangle,
  Check,
  Loader2,
} from 'lucide-react';

// Generate month options for selectors
const generateMonthOptions = () => {
  const months = [];
  const now = new Date();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  for (let i = -3; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    months.push({ value, label });
  }
  return months;
};

const MONTH_OPTIONS = generateMonthOptions();

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja', color: 'bg-gray-100 text-gray-600' },
  { value: 'medium', label: 'Media', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'Alta', color: 'bg-red-100 text-red-700' },
];

const StructuredBriefCreator = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clients, setClients] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});

  // Brief data
  const [briefData, setBriefData] = useState({
    client_id: '',
    title: '',
    month: getCurrentMonth(),
    visible_to_client: true,
    sections: [],
  });

  // Generated project info
  const [generatedProject, setGeneratedProject] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    try {
      const [clientsRes, teamRes, areasRes] = await Promise.all([
        clientsAPI.getAll(),
        teamAPI.getAll(),
        structuredBriefsAPI.getAreas(),
      ]);

      setClients(clientsRes.data.filter(c => c.status === 'active'));
      setTeamMembers(teamRes.data.filter(m => m.status === 'active'));
      setAreas(areasRes.data);

      if (isEditing) {
        // Load existing brief
        const briefRes = await structuredBriefsAPI.getById(id);
        setBriefData({
          client_id: briefRes.data.client_id,
          title: briefRes.data.title,
          month: briefRes.data.month || getCurrentMonth(),
          visible_to_client: Boolean(briefRes.data.visible_to_client),
          sections: briefRes.data.sections || [],
        });
        if (briefRes.data.generated_project_id) {
          setGeneratedProject({
            id: briefRes.data.generated_project_id,
            name: briefRes.data.generated_project_name,
          });
        }
        // Expand all sections by default when editing
        const expanded = {};
        (briefRes.data.sections || []).forEach((_, i) => {
          expanded[i] = true;
        });
        setExpandedSections(expanded);
      } else {
        // Initialize with default areas
        const initialSections = areasRes.data.map((area, index) => ({
          area_key: area.key,
          area_name: area.name,
          responsible_id: area.default_responsible_id || '',
          context_text: '',
          order_index: index,
          tasks: [],
        }));
        setBriefData(prev => ({ ...prev, sections: initialSections }));
        // Expand all sections
        const expanded = {};
        initialSections.forEach((_, i) => {
          expanded[i] = true;
        });
        setExpandedSections(expanded);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === parseInt(clientId));
    setBriefData(prev => ({
      ...prev,
      client_id: clientId,
      title: client ? `Brief ${client.nickname || client.company} - ${MONTH_OPTIONS.find(m => m.value === prev.month)?.label || ''}` : prev.title,
    }));
  };

  const handleMonthChange = (month) => {
    const client = clients.find(c => c.id === parseInt(briefData.client_id));
    setBriefData(prev => ({
      ...prev,
      month,
      title: client ? `Brief ${client.nickname || client.company} - ${MONTH_OPTIONS.find(m => m.value === month)?.label || ''}` : prev.title,
    }));
  };

  const toggleSection = (index) => {
    setExpandedSections(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const updateSection = (index, field, value) => {
    setBriefData(prev => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  };

  const addTask = (sectionIndex) => {
    setBriefData(prev => ({
      ...prev,
      sections: prev.sections.map((s, i) =>
        i === sectionIndex
          ? {
              ...s,
              tasks: [
                ...s.tasks,
                {
                  title: '',
                  description: '',
                  due_date: '',
                  priority: 'medium',
                  order_index: s.tasks.length,
                },
              ],
            }
          : s
      ),
    }));
  };

  const updateTask = (sectionIndex, taskIndex, field, value) => {
    setBriefData(prev => ({
      ...prev,
      sections: prev.sections.map((s, si) =>
        si === sectionIndex
          ? {
              ...s,
              tasks: s.tasks.map((t, ti) => (ti === taskIndex ? { ...t, [field]: value } : t)),
            }
          : s
      ),
    }));
  };

  const removeTask = (sectionIndex, taskIndex) => {
    setBriefData(prev => ({
      ...prev,
      sections: prev.sections.map((s, si) =>
        si === sectionIndex
          ? {
              ...s,
              tasks: s.tasks.filter((_, ti) => ti !== taskIndex),
            }
          : s
      ),
    }));
  };

  const handleSave = async () => {
    if (!briefData.client_id) {
      alert('Por favor selecciona un cliente');
      return;
    }

    const sectionsWithTasks = briefData.sections.filter(s => s.tasks.length > 0);
    if (sectionsWithTasks.length === 0) {
      alert('Por favor agrega al menos una tarea a alguna sección');
      return;
    }

    // Validate all tasks have title
    for (const section of briefData.sections) {
      for (const task of section.tasks) {
        if (!task.title.trim()) {
          alert('Todas las tareas deben tener un título');
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (isEditing) {
        await structuredBriefsAPI.update(id, briefData);
      } else {
        const res = await structuredBriefsAPI.create(briefData);
        navigate(`/briefs/structured/${res.data.id}`, { replace: true });
      }
      alert('Brief guardado exitosamente');
    } catch (error) {
      console.error('Error saving brief:', error);
      alert('Error al guardar el brief');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateProject = async () => {
    if (!id) {
      alert('Primero guarda el brief');
      return;
    }

    if (generatedProject) {
      alert('Este brief ya tiene un proyecto generado');
      return;
    }

    if (!confirm('¿Generar el proyecto y tareas? Esta acción no se puede deshacer.')) {
      return;
    }

    setGenerating(true);
    try {
      const res = await structuredBriefsAPI.generateProject(id);
      setGeneratedProject({
        id: res.data.project_id,
        name: res.data.project_name,
      });
      alert(`Proyecto creado con ${res.data.task_count} tareas`);
    } catch (error) {
      console.error('Error generating project:', error);
      alert(error.response?.data?.error || 'Error al generar el proyecto');
    } finally {
      setGenerating(false);
    }
  };

  const getTotalTasks = () => {
    return briefData.sections.reduce((sum, s) => sum + s.tasks.length, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/briefs')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Editar Brief Estructurado' : 'Nuevo Brief Estructurado'}
            </h1>
            <p className="text-sm text-gray-500">
              {getTotalTasks()} tareas en {briefData.sections.filter(s => s.tasks.length > 0).length} áreas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {generatedProject && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm">
              <Check className="w-4 h-4" />
              <span>Proyecto generado</span>
              <button
                onClick={() => navigate(`/projects/${generatedProject.id}`)}
                className="underline hover:no-underline"
              >
                Ver
              </button>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>

          {isEditing && !generatedProject && (
            <button
              onClick={handleGenerateProject}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Generar Proyecto
            </button>
          )}
        </div>
      </div>

      {/* Brief Metadata */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <select
              value={briefData.client_id}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isEditing}
            >
              <option value="">Seleccionar cliente</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.nickname || client.company}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
            <select
              value={briefData.month}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {MONTH_OPTIONS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={briefData.title}
              onChange={(e) => setBriefData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief Cliente - Mes 2026"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="visible_to_client"
            checked={briefData.visible_to_client}
            onChange={(e) => setBriefData(prev => ({ ...prev, visible_to_client: e.target.checked }))}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="visible_to_client" className="text-sm text-gray-700">
            Visible en el portal del cliente
          </label>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {briefData.sections.map((section, sectionIndex) => (
          <div
            key={section.area_key}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* Section Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
              onClick={() => toggleSection(sectionIndex)}
            >
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <h3 className="font-semibold text-gray-900">{section.area_name}</h3>
                <span className="text-sm text-gray-500">
                  {section.tasks.length} {section.tasks.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={section.responsible_id || ''}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateSection(sectionIndex, 'responsible_id', e.target.value || null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm px-2 py-1 border rounded-lg bg-white"
                >
                  <option value="">Sin responsable</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {expandedSections[sectionIndex] ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* Section Content */}
            {expandedSections[sectionIndex] && (
              <div className="p-4">
                {/* Context */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Contexto / Notas del área
                  </label>
                  <textarea
                    value={section.context_text || ''}
                    onChange={(e) => updateSection(sectionIndex, 'context_text', e.target.value)}
                    placeholder="Agrega contexto o notas generales para esta área..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={2}
                  />
                </div>

                {/* Tasks */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700">Tareas</h4>
                    <button
                      onClick={() => addTask(sectionIndex)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar tarea
                    </button>
                  </div>

                  {section.tasks.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed rounded-lg">
                      No hay tareas. Haz clic en "Agregar tarea" para comenzar.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {section.tasks.map((task, taskIndex) => (
                        <div
                          key={taskIndex}
                          className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => updateTask(sectionIndex, taskIndex, 'title', e.target.value)}
                              placeholder="Título de la tarea *"
                              className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <textarea
                              value={task.description || ''}
                              onChange={(e) => updateTask(sectionIndex, taskIndex, 'description', e.target.value)}
                              placeholder="Descripción detallada (opcional)"
                              className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                              rows={2}
                            />
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <input
                                  type="date"
                                  value={task.due_date || ''}
                                  onChange={(e) => updateTask(sectionIndex, taskIndex, 'due_date', e.target.value)}
                                  className="text-sm px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <select
                                value={task.priority}
                                onChange={(e) => updateTask(sectionIndex, taskIndex, 'priority', e.target.value)}
                                className={`text-sm px-2 py-1 rounded-lg border ${
                                  PRIORITY_OPTIONS.find(p => p.value === task.priority)?.color || ''
                                }`}
                              >
                                {PRIORITY_OPTIONS.map(p => (
                                  <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <button
                            onClick={() => removeTask(sectionIndex, taskIndex)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="mt-8 flex items-center justify-between pb-8">
        <button
          onClick={() => navigate('/briefs')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          Cancelar
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? 'Guardar cambios' : 'Crear Brief'}
          </button>

          {isEditing && !generatedProject && (
            <button
              onClick={handleGenerateProject}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Guardar y Generar Proyecto
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StructuredBriefCreator;
