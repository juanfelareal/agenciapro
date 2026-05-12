import { useEffect, useState } from 'react';
import { BarChart3, FileText, Loader2, Download, Calendar } from 'lucide-react';
import { portalReportsAPI } from '../../utils/portalApi';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
const fileUrl = (p) => (p?.startsWith('http') ? p : `${API_ORIGIN}${p}`);

const TYPE_LABELS = {
  monthly: 'Cierre de mes',
  biweekly: 'Reporte parcial',
  other: 'Otro',
};

const formatDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatSize = (b) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export default function PortalReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await portalReportsAPI.list();
        setReports(data.reports || []);
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

  // Group by year-month using period_start when available, otherwise created_at
  const groups = {};
  reports.forEach((r) => {
    const key = (r.period_start || r.created_at).slice(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
          <BarChart3 className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Reportes</h1>
          <p className="text-sm text-ink-500 mt-0.5">Reportes de cierre y avances que tu agencia ha publicado</p>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16 text-ink-500">
          <BarChart3 className="w-12 h-12 mx-auto text-ink-300 mb-3" />
          <p>Aún no hay reportes publicados.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedKeys.map((key) => {
            const [y, m] = key.split('-').map(Number);
            const monthLabel = new Date(y, (m || 1) - 1, 1).toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
            });
            return (
              <div key={key}>
                <h2 className="text-sm font-medium text-ink-500 uppercase tracking-wide mb-3 capitalize">
                  {monthLabel}
                </h2>
                <div className="space-y-2">
                  {groups[key].map((r) => (
                    <a
                      key={r.id}
                      href={fileUrl(r.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white border border-ink-100 rounded-2xl p-4 hover:border-ink-300 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-red-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-ink-900 truncate">{r.title}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-ink-500">
                              <span className="px-2 py-0.5 rounded-full bg-ink-100">
                                {TYPE_LABELS[r.report_type] || r.report_type}
                              </span>
                              {r.period_label && (
                                <span className="flex items-center gap-1">
                                  <Calendar size={12} />
                                  {r.period_label}
                                </span>
                              )}
                              {!r.period_label && r.period_start && r.period_end && (
                                <span className="flex items-center gap-1">
                                  <Calendar size={12} />
                                  {formatDate(r.period_start)} – {formatDate(r.period_end)}
                                </span>
                              )}
                              <span>{formatSize(r.file_size)}</span>
                            </div>
                          </div>
                        </div>
                        <Download className="w-5 h-5 text-ink-400 group-hover:text-ink-900 shrink-0" />
                      </div>
                    </a>
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
