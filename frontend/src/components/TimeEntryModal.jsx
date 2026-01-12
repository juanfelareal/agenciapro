import { useState, useEffect } from 'react';
import { X, Clock, Calendar, DollarSign } from 'lucide-react';
import { useUser } from '../context/UserContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TimeEntryModal = ({ isOpen, onClose, onSave, entry = null }) => {
  const { currentUser, members } = useUser();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [formData, setFormData] = useState({
    user_id: currentUser?.id || '',
    project_id: '',
    task_id: '',
    description: '',
    start_time: '',
    end_time: '',
    duration_hours: '',
    duration_minutes: '',
    billable: true,
    hourly_rate: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [useDuration, setUseDuration] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      if (entry) {
        // Edit mode
        const startDate = new Date(entry.start_time);
        const endDate = entry.end_time ? new Date(entry.end_time) : null;
        setFormData({
          user_id: entry.user_id || currentUser?.id || '',
          project_id: entry.project_id || '',
          task_id: entry.task_id || '',
          description: entry.description || '',
          start_time: formatDateTimeLocal(startDate),
          end_time: endDate ? formatDateTimeLocal(endDate) : '',
          duration_hours: entry.duration_minutes ? Math.floor(entry.duration_minutes / 60) : '',
          duration_minutes: entry.duration_minutes ? entry.duration_minutes % 60 : '',
          billable: entry.billable === 1,
          hourly_rate: entry.hourly_rate || ''
        });
        if (entry.project_id) {
          fetchTasks(entry.project_id);
        }
      } else {
        // New entry - set defaults
        const now = new Date();
        setFormData({
          user_id: currentUser?.id || '',
          project_id: '',
          task_id: '',
          description: '',
          start_time: formatDateTimeLocal(now),
          end_time: '',
          duration_hours: '',
          duration_minutes: '',
          billable: true,
          hourly_rate: ''
        });
      }
    }
  }, [isOpen, entry, currentUser]);

  const formatDateTimeLocal = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16);
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/projects`);
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchTasks = async (projectId) => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/tasks?project_id=${projectId}`);
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const handleProjectChange = (projectId) => {
    setFormData(prev => ({
      ...prev,
      project_id: projectId,
      task_id: ''
    }));
    fetchTasks(projectId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let duration_minutes = null;
      if (useDuration) {
        const hours = parseInt(formData.duration_hours) || 0;
        const mins = parseInt(formData.duration_minutes) || 0;
        duration_minutes = hours * 60 + mins;
      }

      const payload = {
        user_id: parseInt(formData.user_id) || (currentUser?.id || 1),
        project_id: formData.project_id ? parseInt(formData.project_id) : null,
        task_id: formData.task_id ? parseInt(formData.task_id) : null,
        description: formData.description || null,
        start_time: formData.start_time,
        end_time: useDuration ? null : (formData.end_time || null),
        duration_minutes: useDuration ? duration_minutes : null,
        billable: formData.billable,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null
      };

      const url = entry
        ? `${API_URL}/time-entries/${entry.id}`
        : `${API_URL}/time-entries`;

      const res = await fetch(url, {
        method: entry ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save time entry');

      const savedEntry = await res.json();
      onSave(savedEntry);
      onClose();
    } catch (error) {
      console.error('Error saving time entry:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ink-100">
          <h3 className="text-lg font-semibold text-ink-900">
            {entry ? 'Editar Registro de Tiempo' : 'Agregar Tiempo Manual'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ink-50 text-ink-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Description */}
          <div>
            <label className="label">Descripción</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="¿En qué trabajaste?"
              className="input"
            />
          </div>

          {/* User selector (for admin) */}
          {(!currentUser || currentUser.role === 'admin') && (
            <div>
              <label className="label">Usuario</label>
              <select
                value={formData.user_id}
                onChange={(e) => setFormData(prev => ({ ...prev, user_id: e.target.value }))}
                className="select"
                required
              >
                <option value="">Seleccionar usuario</option>
                {members.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Project */}
          <div>
            <label className="label">Proyecto</label>
            <select
              value={formData.project_id}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="select"
            >
              <option value="">Sin proyecto</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          {/* Task */}
          {tasks.length > 0 && (
            <div>
              <label className="label">Tarea</label>
              <select
                value={formData.task_id}
                onChange={(e) => setFormData(prev => ({ ...prev, task_id: e.target.value }))}
                className="select"
              >
                <option value="">Sin tarea</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Time Input Mode Toggle */}
          <div className="flex gap-2 p-1 bg-ink-50 rounded-lg">
            <button
              type="button"
              onClick={() => setUseDuration(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !useDuration ? 'bg-white shadow text-ink-900' : 'text-ink-500'
              }`}
            >
              <Calendar size={14} className="inline mr-1" />
              Hora Inicio/Fin
            </button>
            <button
              type="button"
              onClick={() => setUseDuration(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                useDuration ? 'bg-white shadow text-ink-900' : 'text-ink-500'
              }`}
            >
              <Clock size={14} className="inline mr-1" />
              Duración
            </button>
          </div>

          {/* Time Inputs */}
          {useDuration ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Horas</label>
                <input
                  type="number"
                  min="0"
                  value={formData.duration_hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_hours: e.target.value }))}
                  placeholder="0"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Minutos</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: e.target.value }))}
                  placeholder="0"
                  className="input"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Hora Inicio</label>
                <input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Hora Fin</label>
                <input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
          )}

          {/* Billable & Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="billable"
                checked={formData.billable}
                onChange={(e) => setFormData(prev => ({ ...prev, billable: e.target.checked }))}
                className="w-4 h-4 rounded border-ink-300 text-success-500 focus:ring-success-500"
              />
              <label htmlFor="billable" className="text-sm text-ink-700">
                <DollarSign size={14} className="inline mr-1" />
                Facturable
              </label>
            </div>
            <div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.hourly_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: e.target.value }))}
                placeholder="Tarifa/hora"
                className="input"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Guardando...' : (entry ? 'Guardar Cambios' : 'Agregar Tiempo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeEntryModal;
