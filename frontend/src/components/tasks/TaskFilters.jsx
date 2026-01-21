import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, User, Flag, Calendar, Folder, Tag, Check, Building2 } from 'lucide-react';

const priorityOptions = [
  { value: 'low', label: 'Baja', color: 'bg-gray-200 text-gray-700' },
  { value: 'medium', label: 'Media', color: 'bg-blue-200 text-blue-700' },
  { value: 'high', label: 'Alta', color: 'bg-orange-200 text-orange-700' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-200 text-red-700' },
];

const statusOptions = [
  { value: 'todo', label: 'Por Hacer', color: 'bg-gray-100' },
  { value: 'in_progress', label: 'En Progreso', color: 'bg-blue-100' },
  { value: 'review', label: 'En Revisión', color: 'bg-yellow-100' },
  { value: 'done', label: 'Completado', color: 'bg-green-100' },
];

// Multi-select dropdown component
function MultiSelectDropdown({ label, icon: Icon, options, selected, onChange, renderOption }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors ${
          selected.length > 0 ? 'border-primary-300 bg-primary-50' : 'border-gray-200'
        }`}
      >
        <Icon size={16} className="text-gray-500" />
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full">
            {selected.length}
          </span>
        )}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleOption(option.value)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
            >
              <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                selected.includes(option.value) ? 'bg-primary-500 border-primary-500' : 'border-gray-300'
              }`}>
                {selected.includes(option.value) && <Check size={12} className="text-white" />}
              </div>
              {renderOption ? renderOption(option) : <span className="text-sm">{option.label}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaskFilters({
  filters,
  onChange,
  teamMembers = [],
  projects = [],
  tags = [],
  clients = [],
  showStatusFilter = false,
}) {
  const activeFilterCount = [
    filters.assignees?.length > 0,
    filters.priorities?.length > 0,
    filters.dueDateFrom || filters.dueDateTo,
    filters.projects?.length > 0,
    filters.tags?.length > 0,
    filters.statuses?.length > 0,
    filters.clients?.length > 0,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onChange({
      assignees: [],
      priorities: [],
      dueDateFrom: '',
      dueDateTo: '',
      projects: [],
      tags: [],
      statuses: [],
      clients: [],
      search: '',
    });
  };

  const updateFilter = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  // Convert team members to options
  const assigneeOptions = teamMembers.map(m => ({
    value: m.id,
    label: m.name,
    avatar: m.name?.charAt(0).toUpperCase(),
  }));

  // Convert projects to options
  const projectOptions = projects.map(p => ({
    value: p.id,
    label: p.name,
  }));

  // Convert tags to options
  const tagOptions = tags.map(t => ({
    value: t.id,
    label: t.name,
    color: t.color,
  }));

  // Convert clients to options
  const clientOptions = clients.map(c => ({
    value: c.id,
    label: c.company || c.name,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Assignee Filter */}
        <MultiSelectDropdown
          label="Responsable"
          icon={User}
          options={assigneeOptions}
          selected={filters.assignees || []}
          onChange={(value) => updateFilter('assignees', value)}
          renderOption={(option) => (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium">
                {option.avatar}
              </div>
              <span className="text-sm">{option.label}</span>
            </div>
          )}
        />

        {/* Priority Filter */}
        <MultiSelectDropdown
          label="Prioridad"
          icon={Flag}
          options={priorityOptions}
          selected={filters.priorities || []}
          onChange={(value) => updateFilter('priorities', value)}
          renderOption={(option) => (
            <span className={`px-2 py-0.5 rounded text-xs ${option.color}`}>
              {option.label}
            </span>
          )}
        />

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-500" />
          <input
            type="date"
            value={filters.dueDateFrom || ''}
            onChange={(e) => updateFilter('dueDateFrom', e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-32"
            placeholder="Desde"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={filters.dueDateTo || ''}
            onChange={(e) => updateFilter('dueDateTo', e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-32"
            placeholder="Hasta"
          />
        </div>

        {/* Client Filter */}
        {clientOptions.length > 0 && (
          <MultiSelectDropdown
            label="Cliente"
            icon={Building2}
            options={clientOptions}
            selected={filters.clients || []}
            onChange={(value) => updateFilter('clients', value)}
          />
        )}

        {/* Project Filter */}
        {projectOptions.length > 0 && (
          <MultiSelectDropdown
            label="Proyecto"
            icon={Folder}
            options={projectOptions}
            selected={filters.projects || []}
            onChange={(value) => updateFilter('projects', value)}
          />
        )}

        {/* Tags Filter */}
        {tagOptions.length > 0 && (
          <MultiSelectDropdown
            label="Etiquetas"
            icon={Tag}
            options={tagOptions}
            selected={filters.tags || []}
            onChange={(value) => updateFilter('tags', value)}
            renderOption={(option) => (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: option.color }}
                />
                <span className="text-sm">{option.label}</span>
              </div>
            )}
          />
        )}

        {/* Status Filter - Only show in list/calendar views */}
        {showStatusFilter && (
          <MultiSelectDropdown
            label="Estado"
            icon={Flag}
            options={statusOptions}
            selected={filters.statuses || []}
            onChange={(value) => updateFilter('statuses', value)}
            renderOption={(option) => (
              <span className={`px-2 py-0.5 rounded text-xs ${option.color}`}>
                {option.label}
              </span>
            )}
          />
        )}

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X size={14} />
            Limpiar ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Active Filter Tags */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          {filters.assignees?.map(id => {
            const member = teamMembers.find(m => m.id === id);
            return member && (
              <span key={id} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs">
                <User size={12} />
                {member.name}
                <button onClick={() => updateFilter('assignees', filters.assignees.filter(a => a !== id))} className="hover:text-red-500">
                  <X size={12} />
                </button>
              </span>
            );
          })}
          {filters.priorities?.map(priority => (
            <span key={priority} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${priorityOptions.find(p => p.value === priority)?.color}`}>
              {priorityOptions.find(p => p.value === priority)?.label}
              <button onClick={() => updateFilter('priorities', filters.priorities.filter(p => p !== priority))} className="hover:text-red-500">
                <X size={12} />
              </button>
            </span>
          ))}
          {(filters.dueDateFrom || filters.dueDateTo) && (
            <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs">
              <Calendar size={12} />
              {filters.dueDateFrom || '...'} - {filters.dueDateTo || '...'}
              <button onClick={() => { updateFilter('dueDateFrom', ''); updateFilter('dueDateTo', ''); }} className="hover:text-red-500">
                <X size={12} />
              </button>
            </span>
          )}
          {filters.clients?.map(id => {
            const client = clients.find(c => c.id === id);
            return client && (
              <span key={id} className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                <Building2 size={12} />
                {client.company || client.name}
                <button onClick={() => updateFilter('clients', filters.clients.filter(c => c !== id))} className="hover:text-red-500">
                  <X size={12} />
                </button>
              </span>
            );
          })}
          {filters.projects?.map(id => {
            const project = projects.find(p => p.id === id);
            return project && (
              <span key={id} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs">
                <Folder size={12} />
                {project.name}
                <button onClick={() => updateFilter('projects', filters.projects.filter(p => p !== id))} className="hover:text-red-500">
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
