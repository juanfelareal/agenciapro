import { useEffect, useState } from 'react';
import { FileCode2, X, Maximize2, Minimize2 } from 'lucide-react';
import { briefsAPI } from '../../../utils/api';

const BriefsWidget = ({ widget }) => {
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewBrief, setPreviewBrief] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const loadBriefs = async () => {
      try {
        const response = await briefsAPI.getAll();
        const limit = widget.size === 'large' ? 8 : 5;
        setBriefs(
          response.data
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .slice(0, limit)
        );
      } catch (error) {
        console.error('Error loading briefs:', error);
      } finally {
        setLoading(false);
      }
    };
    loadBriefs();
  }, [widget.size]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <FileCode2 className="w-5 h-5 text-violet-600" />
          </div>
          <h2 className="text-lg font-semibold text-ink-900">Briefs</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-ink-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (briefs.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-10">
        <FileCode2 className="w-10 h-10 text-gray-300 mb-2" />
        <p className="text-sm text-ink-500">No hay briefs creados</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <FileCode2 className="w-5 h-5 text-violet-600" />
          </div>
          <h2 className="text-lg font-semibold text-ink-900">Briefs</h2>
        </div>
        <div className="space-y-2">
          {briefs.map((brief) => (
            <button
              key={brief.id}
              onClick={() => setPreviewBrief(brief)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-ink-50 hover:bg-ink-100 transition-colors text-left"
            >
              <div className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileCode2 className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">{brief.title}</p>
                <p className="text-xs text-ink-400 truncate">
                  {brief.client_nickname || brief.client_company || brief.client_name || 'Sin cliente'}
                </p>
              </div>
              <span className="text-xs text-ink-400 whitespace-nowrap flex-shrink-0">
                {new Date(brief.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive HTML Preview Modal */}
      {previewBrief && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div
            className={`bg-white shadow-xl flex flex-col ${
              fullscreen ? 'w-full h-full' : 'rounded-2xl w-full max-w-5xl h-[85vh]'
            }`}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="font-semibold text-[#1A1A2E]">{previewBrief.title}</h3>
                <p className="text-xs text-gray-400">
                  {previewBrief.client_nickname || previewBrief.client_company || previewBrief.client_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFullscreen(!fullscreen)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  onClick={() => {
                    setPreviewBrief(null);
                    setFullscreen(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                srcDoc={
                  previewBrief.html_content ||
                  '<p style="padding:2rem;color:#999">Sin contenido HTML</p>'
                }
                className="w-full h-full border-0"
                title={previewBrief.title}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BriefsWidget;
