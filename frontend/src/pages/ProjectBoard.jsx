import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsAPI, tasksAPI } from '../utils/api';
import { ArrowLeft, LayoutGrid, GanttChartSquare } from 'lucide-react';
import GanttView from '../components/GanttView';
import TableView from '../components/TableView';

const ProjectBoard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [activeView, setActiveView] = useState('gantt'); // 'table', 'kanban', 'gantt', 'calendar'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id]);

  const loadProject = async () => {
    try {
      const response = await projectsAPI.getById(id);
      setProject(response.data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  if (!project) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Proyecto no encontrado</p>
        <button
          onClick={() => navigate('/app/projects')}
          className="mt-4 text-[#1A1A2E] hover:underline"
        >
          Volver a proyectos
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/projects')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft size={20} />
          Volver a Proyectos
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">{project.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{project.description || 'Gestión de proyecto'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Cliente</p>
            <p className="font-medium">{project.client_name || 'Sin asignar'}</p>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex gap-4 px-6">
            <button
              onClick={() => setActiveView('table')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition ${
                activeView === 'table'
                  ? 'border-[#1A1A2E] text-[#1A1A2E]'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <LayoutGrid size={18} />
              Vista de Tabla
            </button>
            <button
              onClick={() => setActiveView('gantt')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition ${
                activeView === 'gantt'
                  ? 'border-[#1A1A2E] text-[#1A1A2E]'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <GanttChartSquare size={18} />
              Vista Gantt
            </button>
          </nav>
        </div>

        {/* View Content */}
        <div className="p-6">
          {activeView === 'table' && (
            <TableView projectId={id} />
          )}

          {activeView === 'gantt' && (
            <GanttView projectId={id} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectBoard;
