import { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Calendar,
  Filter,
  Play,
  Square,
  Briefcase,
  FileText,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { teamAPI } from '../utils/api';
import TimeEntryModal from '../components/TimeEntryModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const Timesheet = () => {
  const { user, isAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [entries, setEntries] = useState([]);
  const [timesheetData, setTimesheetData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedUser, setSelectedUser] = useState(user?.id || '');

  // Live timer state
  const [runningEntry, setRunningEntry] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  // Load team members for admin
  useEffect(() => {
    const loadMembers = async () => {
      if (isAdmin) {
        try {
          const response = await teamAPI.getAll({ status: 'active' });
          setMembers(response.data || []);
        } catch (error) {
          console.error('Error loading members:', error);
        }
      }
    };
    loadMembers();
  }, [isAdmin]);

  useEffect(() => {
    fetchTimesheet();
  }, [currentWeekStart, selectedUser]);

  // Fetch running timer on mount and periodically
  useEffect(() => {
    fetchRunningTimer();
    const interval = setInterval(fetchRunningTimer, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [user]);

  // Update elapsed time every second when timer is running
  useEffect(() => {
    let interval;
    if (runningEntry) {
      const calculateElapsed = () => {
        let startTime = runningEntry.start_time;
        if (startTime && !startTime.includes('T') && !startTime.includes('Z')) {
          startTime = startTime.replace(' ', 'T') + 'Z';
        }
        const start = new Date(startTime);
        const now = new Date();
        const elapsed = Math.floor((now - start) / 1000);
        return Math.max(0, elapsed);
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

  const fetchRunningTimer = async () => {
    try {
      const res = await fetch(`${API_URL}/time-entries/running`);
      const data = await res.json();
      const userTimer = data.find(e =>
        user ? e.user_id === user.id : true
      );
      setRunningEntry(userTimer || null);
    } catch (error) {
      console.error('Error fetching running timer:', error);
    }
  };

  const stopTimer = async () => {
    if (!runningEntry) return;
    try {
      await fetch(`${API_URL}/time-entries/${runningEntry.id}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: runningEntry.description })
      });
      setRunningEntry(null);
      setElapsedTime(0);
      fetchTimesheet(); // Refresh the timesheet data
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  };

  const handleResumeEntry = async (entry) => {
    // Ask for confirmation if there's already a running timer
    if (runningEntry) {
      if (!confirm('Ya hay un temporizador activo. ¿Detenerlo y reanudar este?')) {
        return;
      }
    }

    try {
      const res = await fetch(`${API_URL}/time-entries/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          task_id: entry.task_id || null,
          project_id: entry.project_id || null,
          description: entry.description || null
        })
      });

      if (!res.ok) throw new Error('Failed to resume timer');

      const newEntry = await res.json();
      setRunningEntry(newEntry);
      setElapsedTime(0);
      fetchTimesheet();
    } catch (error) {
      console.error('Error resuming timer:', error);
    }
  };

  const formatElapsedTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchTimesheet = async () => {
    setIsLoading(true);
    try {
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      // Fetch timesheet data
      let url = `${API_URL}/time-entries/timesheet?start_date=${startDate}&end_date=${endDate}`;
      if (selectedUser) {
        url += `&user_id=${selectedUser}`;
      }
      const timesheetRes = await fetch(url);
      const timesheetJson = await timesheetRes.json();
      setTimesheetData(timesheetJson);

      // Fetch raw entries for editing
      let entriesUrl = `${API_URL}/time-entries?start_date=${startDate}&end_date=${endDate}`;
      if (selectedUser) {
        entriesUrl += `&user_id=${selectedUser}`;
      }
      const entriesRes = await fetch(entriesUrl);
      const entriesJson = await entriesRes.json();
      setEntries(entriesJson);
    } catch (error) {
      console.error('Error fetching timesheet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => addWeeks(prev, 1));
  };

  const handleThisWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const handleDeleteEntry = async (entryId) => {
    if (!confirm('¿Eliminar este registro de tiempo?')) return;
    try {
      await fetch(`${API_URL}/time-entries/${entryId}`, { method: 'DELETE' });
      fetchTimesheet();
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  const handleSaveEntry = () => {
    setEditingEntry(null);
    fetchTimesheet();
  };

  const formatMinutes = (minutes) => {
    if (!minutes) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins > 0 ? `${mins}m` : ''}`;
  };

  const getEntriesForDay = (date) => {
    return entries.filter(entry => {
      const entryDate = parseISO(entry.start_time);
      return isSameDay(entryDate, date);
    });
  };

  const getDayTotal = (date) => {
    const dayEntries = getEntriesForDay(date);
    return dayEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Timesheet</h1>
          <p className="text-ink-500 text-sm mt-1">
            Registro de tiempo semanal
          </p>
        </div>
        <button
          onClick={() => {
            setEditingEntry(null);
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Agregar Tiempo
        </button>
      </div>

      {/* Week Navigation */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousWeek}
              className="p-2 rounded-lg hover:bg-ink-50 text-ink-600"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center min-w-[200px]">
              <span className="font-medium text-ink-900">
                {format(currentWeekStart, 'd MMM', { locale: es })} -{' '}
                {format(weekEnd, 'd MMM yyyy', { locale: es })}
              </span>
            </div>
            <button
              onClick={handleNextWeek}
              className="p-2 rounded-lg hover:bg-ink-50 text-ink-600"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={handleThisWeek}
              className="ml-2 px-3 py-1.5 text-sm font-medium text-success-600 hover:bg-success-50 rounded-lg"
            >
              Hoy
            </button>
          </div>

          {/* User Filter */}
          {(!user || user.role === 'admin') && (
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-ink-400" />
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="select text-sm py-1.5"
              >
                <option value="">Todos los usuarios</option>
                {members.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center gap-2 px-4 py-2 bg-success-50 rounded-lg">
            <Clock size={18} className="text-success-600" />
            <span className="font-semibold text-success-700">
              {timesheetData ? `${timesheetData.total_hours}h` : '0h'}
            </span>
            <span className="text-sm text-success-600">esta semana</span>
          </div>
        </div>
      </div>

      {/* Live Timer - Currently Working On */}
      {runningEntry && (
        <div className="card overflow-hidden border-2 border-success-200 bg-gradient-to-r from-success-50 to-emerald-50">
          <div className="p-4">
            <div className="flex items-center justify-between">
              {/* Left: Task Info */}
              <div className="flex items-center gap-4">
                {/* Pulsing indicator */}
                <div className="relative">
                  <div className="w-3 h-3 bg-success-500 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 w-3 h-3 bg-success-500 rounded-full animate-ping opacity-75"></div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-success-600 uppercase tracking-wide mb-1">
                    <Play size={12} fill="currentColor" />
                    Trabajando ahora
                  </div>

                  {/* Task/Description */}
                  <h3 className="text-lg font-semibold text-ink-900">
                    {runningEntry.task_title || runningEntry.description || 'Sin descripción'}
                  </h3>

                  {/* Project & Details */}
                  <div className="flex items-center gap-3 mt-1 text-sm text-ink-600">
                    {runningEntry.project_name && (
                      <span className="flex items-center gap-1">
                        <Briefcase size={14} className="text-ink-400" />
                        {runningEntry.project_name}
                      </span>
                    )}
                    {runningEntry.task_title && runningEntry.description && (
                      <span className="flex items-center gap-1">
                        <FileText size={14} className="text-ink-400" />
                        {runningEntry.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Timer & Stop Button */}
              <div className="flex items-center gap-4">
                {/* Live Timer */}
                <div className="text-right">
                  <div className="text-3xl font-mono font-bold text-success-700">
                    {formatElapsedTime(elapsedTime)}
                  </div>
                  <div className="text-xs text-success-600 mt-0.5">
                    Iniciado {format(
                      parseISO(runningEntry.start_time.includes('T')
                        ? runningEntry.start_time
                        : runningEntry.start_time.replace(' ', 'T') + 'Z'
                      ),
                      'HH:mm',
                      { locale: es }
                    )}
                  </div>
                </div>

                {/* Stop Button */}
                <button
                  onClick={stopTimer}
                  className="flex items-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-500/25"
                >
                  <Square size={18} fill="currentColor" />
                  Detener
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timesheet Grid */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-ink-50">
                <th className="text-left p-4 font-medium text-ink-600 min-w-[200px]">
                  Proyecto
                </th>
                {weekDays.map(day => (
                  <th
                    key={day.toISOString()}
                    className={`text-center p-4 font-medium min-w-[100px] ${
                      isSameDay(day, new Date())
                        ? 'bg-success-50 text-success-700'
                        : 'text-ink-600'
                    }`}
                  >
                    <div className="text-xs uppercase">
                      {format(day, 'EEE', { locale: es })}
                    </div>
                    <div className="text-lg">{format(day, 'd')}</div>
                  </th>
                ))}
                <th className="text-center p-4 font-medium text-ink-600 min-w-[100px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-ink-500">
                    Cargando...
                  </td>
                </tr>
              ) : timesheetData?.projects?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-ink-500">
                    No hay registros de tiempo esta semana
                  </td>
                </tr>
              ) : (
                <>
                  {timesheetData?.projects?.map(project => (
                    <tr key={project.project_id || 'no_project'} className="border-t border-ink-100">
                      <td className="p-4">
                        <div className="font-medium text-ink-900">
                          {project.project_name}
                        </div>
                      </td>
                      {weekDays.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const minutes = project.by_date?.[dateStr] || 0;
                        return (
                          <td
                            key={day.toISOString()}
                            className={`text-center p-4 ${
                              isSameDay(day, new Date()) ? 'bg-success-50/50' : ''
                            }`}
                          >
                            {minutes > 0 && (
                              <span className="text-ink-700">
                                {formatMinutes(minutes)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center p-4 font-medium text-ink-900">
                        {formatMinutes(project.total_minutes)}
                      </td>
                    </tr>
                  ))}

                  {/* Daily Totals Row */}
                  <tr className="border-t-2 border-ink-200 bg-ink-50">
                    <td className="p-4 font-semibold text-ink-900">Total Diario</td>
                    {weekDays.map(day => {
                      const total = getDayTotal(day);
                      return (
                        <td
                          key={day.toISOString()}
                          className={`text-center p-4 font-semibold ${
                            isSameDay(day, new Date())
                              ? 'text-success-700'
                              : 'text-ink-900'
                          }`}
                        >
                          {total > 0 ? formatMinutes(total) : '-'}
                        </td>
                      );
                    })}
                    <td className="text-center p-4 font-bold text-success-700">
                      {timesheetData ? formatMinutes(timesheetData.total_minutes) : '-'}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Entries List */}
      <div className="card">
        <div className="p-4 border-b border-ink-100">
          <h3 className="font-semibold text-ink-900">Registros Detallados</h3>
        </div>
        <div className="divide-y divide-ink-100">
          {entries.length === 0 ? (
            <div className="p-8 text-center text-ink-500">
              No hay registros esta semana
            </div>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="p-4 hover:bg-ink-50 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-900">
                      {entry.description || 'Sin descripción'}
                    </span>
                    {entry.billable === 1 && (
                      <span className="px-2 py-0.5 text-xs bg-success-100 text-success-700 rounded-full">
                        Facturable
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-ink-500 mt-1">
                    {entry.project_name && (
                      <span>{entry.project_name}</span>
                    )}
                    {entry.task_title && (
                      <span className="ml-2">• {entry.task_title}</span>
                    )}
                    {entry.user_name && (
                      <span className="ml-2">• {entry.user_name}</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-400 mt-1">
                    <Calendar size={12} className="inline mr-1" />
                    {format(parseISO(entry.start_time), 'dd/MM/yyyy HH:mm', { locale: es })}
                    {entry.end_time && (
                      <> - {format(parseISO(entry.end_time), 'HH:mm', { locale: es })}</>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-ink-900 min-w-[60px] text-right">
                    {formatMinutes(entry.duration_minutes)}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* Resume button - only show for completed entries */}
                    {entry.is_running !== 1 && (
                      <button
                        onClick={() => handleResumeEntry(entry)}
                        className="p-2 rounded-lg hover:bg-success-50 text-success-600"
                        title="Reanudar"
                      >
                        <Play size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleEditEntry(entry)}
                      className="p-2 rounded-lg hover:bg-ink-100 text-ink-500"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-2 rounded-lg hover:bg-danger-50 text-danger-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      <TimeEntryModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
        entry={editingEntry}
      />
    </div>
  );
};

export default Timesheet;
