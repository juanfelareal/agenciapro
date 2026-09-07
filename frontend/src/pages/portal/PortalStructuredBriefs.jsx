import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Calendar, Loader2, Rocket, ChevronRight, CheckCircle2, Clock, Users } from 'lucide-react';
import { portalStructuredBriefsAPI } from '../../utils/portalApi';

const formatMonth = (month) => {
  if (!month) return null;
  const [year, m] = month.split('-');
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${monthNames[parseInt(m, 10) - 1]} ${year}`;
};

export default function PortalStructuredBriefs() {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await portalStructuredBriefsAPI.list();
        setBriefs(data.briefs || []);
      } catch (error) {
        console.error('Error loading structured briefs:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-ink-400" />
      </div>
    );
  }

  // Group by month
  const groups = {};
  briefs.forEach((b) => {
    const key = b.month || 'sin-mes';
    if (!groups[key]) groups[key] = [];
    groups[key].push(b);
  });
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'sin-mes') return 1;
    if (b === 'sin-mes') return -1;
    return b.localeCompare(a);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Layers className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Briefs del Mes</h1>
          <p className="text-sm text-ink-500 mt-0.5">Planes de trabajo organizados por área</p>
        </div>
      </div>

      {briefs.length === 0 ? (
        <div className="text-center py-16 text-ink-500">
          <Layers className="w-12 h-12 mx-auto text-ink-300 mb-3" />
          <p>Aún no hay briefs publicados.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedKeys.map((key) => {
            const monthLabel = key === 'sin-mes' ? 'Sin mes asignado' : formatMonth(key);
            return (
              <div key={key}>
                <h2 className="text-sm font-medium text-ink-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Calendar size={14} />
                  {monthLabel}
                </h2>
                <div className="space-y-2">
                  {groups[key].map((brief) => (
                    <div
                      key={brief.id}
                      onClick={() => navigate(`/portal/briefs/${brief.id}`)}
                      className="block bg-white border border-ink-100 rounded-2xl p-4 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Layers className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-ink-900 truncate">{brief.title}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-ink-500">
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-100">
                                <Users size={12} />
                                {brief.sections_count} áreas
                              </span>
                              {brief.generated_project_id && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                                  <Rocket size={12} />
                                  Proyecto activo
                                </span>
                              )}
                              <span className="text-ink-400">
                                {new Date(brief.created_at).toLocaleDateString('es-CO')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-ink-400 group-hover:text-emerald-500 shrink-0 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
