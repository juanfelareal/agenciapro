import { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock, ChevronDown } from 'lucide-react';
import { useUser } from '../context/UserContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TimeTracker = () => {
  const { currentUser } = useUser();
  const [runningEntry, setRunningEntry] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [description, setDescription] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch running timer on mount
  useEffect(() => {
    fetchRunningTimer();
    fetchTasks();
    fetchProjects();
  }, [currentUser]);

  // Update elapsed time every second
  useEffect(() => {
    let interval;
    if (runningEntry) {
      // Calculate initial elapsed time
      const calculateElapsed = () => {
        // Handle SQLite datetime format (YYYY-MM-DD HH:MM:SS) - treat as UTC
        let startTime = runningEntry.start_time;
        if (startTime && !startTime.includes('T') && !startTime.includes('Z')) {
          // SQLite format without timezone - append Z to treat as UTC
          startTime = startTime.replace(' ', 'T') + 'Z';
        }
        const start = new Date(startTime);
        const now = new Date();
        const elapsed = Math.floor((now - start) / 1000);
        return Math.max(0, elapsed); // Ensure never negative
      };

      setElapsedTime(calculateElapsed());
      interval = setInterval(() => {
        setElapsedTime(calculateElapsed());
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [runningEntry]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchRunningTimer = async () => {
    try {
      const res = await fetch(`${API_URL}/time-entries/running`);
      const data = await res.json();
      const userTimer = data.find(e =>
        currentUser ? e.user_id === currentUser.id : true
      );
      if (userTimer) {
        setRunningEntry(userTimer);
        setDescription(userTimer.description || '');
        if (userTimer.task_id) {
          setSelectedTask({ id: userTimer.task_id, title: userTimer.task_title });
        }
        if (userTimer.project_id) {
          setSelectedProject({ id: userTimer.project_id, name: userTimer.project_name });
        }
      }
    } catch (error) {
      console.error('Error fetching running timer:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks?status=todo&status=in_progress`);
      const data = await res.json();
      setTasks(data.slice(0, 20)); // Limit to 20 recent tasks
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/projects?status=in_progress`);
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const startTimer = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const userId = currentUser?.id || 1; // Default to 1 if no user selected
      const res = await fetch(`${API_URL}/time-entries/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          task_id: selectedTask?.id,
          project_id: selectedProject?.id,
          description: description || null
        })
      });
      const data = await res.json();
      setRunningEntry(data);
      setElapsedTime(0);
    } catch (error) {
      console.error('Error starting timer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopTimer = async () => {
    if (!runningEntry || isLoading) return;
    setIsLoading(true);
    try {
      await fetch(`${API_URL}/time-entries/${runningEntry.id}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });
      setRunningEntry(null);
      setElapsedTime(0);
      setDescription('');
      setSelectedTask(null);
      setSelectedProject(null);
    } catch (error) {
      console.error('Error stopping timer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3">
      {/* Timer Display */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono ${
          runningEntry ? 'bg-success-50 text-success-700' : 'bg-ink-50 text-ink-600'
        }`}
      >
        <Clock size={16} className={runningEntry ? 'animate-pulse' : ''} />
        <span className="min-w-[70px]">{formatTime(elapsedTime)}</span>
      </div>

      {/* Task/Project Selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={runningEntry}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            runningEntry
              ? 'bg-ink-50 text-ink-400 cursor-not-allowed'
              : 'bg-white border-ink-200 hover:border-ink-300 text-ink-700'
          }`}
        >
          <span className="max-w-[150px] truncate">
            {selectedTask?.title || selectedProject?.name || 'Sin tarea'}
          </span>
          <ChevronDown size={14} />
        </button>

        {showDropdown && !runningEntry && (
          <div className="absolute top-full mt-1 right-0 w-72 bg-white rounded-xl shadow-lg border border-ink-100 z-50 max-h-80 overflow-auto">
            {/* Description input */}
            <div className="p-2 border-b border-ink-100">
              <input
                type="text"
                placeholder="¿En qué estás trabajando?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:border-success-500"
              />
            </div>

            {/* Projects */}
            {projects.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-medium text-ink-500 px-2 mb-1">Proyectos</p>
                {projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setSelectedProject(project);
                      setSelectedTask(null);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-ink-50 ${
                      selectedProject?.id === project.id ? 'bg-success-50 text-success-700' : 'text-ink-700'
                    }`}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <div className="p-2 border-t border-ink-100">
                <p className="text-xs font-medium text-ink-500 px-2 mb-1">Tareas Recientes</p>
                {tasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      if (task.project_id) {
                        const project = projects.find(p => p.id === task.project_id);
                        setSelectedProject(project || null);
                      }
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-ink-50 ${
                      selectedTask?.id === task.id ? 'bg-success-50 text-success-700' : 'text-ink-700'
                    }`}
                  >
                    <div className="truncate">{task.title}</div>
                    {task.project_name && (
                      <div className="text-xs text-ink-400 truncate">{task.project_name}</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Clear selection */}
            <div className="p-2 border-t border-ink-100">
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setSelectedProject(null);
                  setShowDropdown(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-ink-500 rounded-lg hover:bg-ink-50"
              >
                Sin tarea asignada
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Start/Stop Button */}
      {runningEntry ? (
        <button
          onClick={stopTimer}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Square size={14} fill="currentColor" />
          Detener
        </button>
      ) : (
        <button
          onClick={startTimer}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Play size={14} fill="currentColor" />
          Iniciar
        </button>
      )}
    </div>
  );
};

export default TimeTracker;
