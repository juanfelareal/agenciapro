// [email] Vista previa (admin) de las plantillas de correo con la marca de la organización.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Smartphone, Monitor, AlertTriangle } from 'lucide-react';
import { orgEmailsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PROVIDER_LABEL = {
  resend: 'Resend',
  smtp: 'SMTP',
  log: 'Sin proveedor (solo consola)',
};

const EmailTemplatesPreview = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState('team-invite');
  const [rendered, setRendered] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    orgEmailsAPI.listTemplates()
      .then((res) => setMeta(res.data))
      .catch((err) => setError(err.response?.data?.error || 'No se pudieron cargar las plantillas'));
  }, []);

  const selectTemplate = (name) => {
    setRendered(null);
    setError('');
    setSelected(name);
  };

  useEffect(() => {
    let active = true;
    orgEmailsAPI.preview(selected)
      .then((res) => { if (active) setRendered(res.data); })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'No se pudo renderizar la plantilla'); });
    return () => { active = false; };
  }, [selected]);

  if (!isAdmin) {
    return (
      <div className="glass-card p-6 max-w-xl">
        <p className="text-sm text-gray-600">Solo los administradores pueden ver las plantillas de correo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button onClick={() => navigate('/app/settings')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#17181A] mb-2">
            <ArrowLeft size={14} /> Configuración
          </button>
          <h1 className="text-2xl font-semibold text-[#17181A] tracking-tight">Plantillas de correo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Así se ven los correos que Orbit envía en nombre de {meta?.brand?.name || 'tu agencia'}. Usan tu logo y tu color de acento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMobile(false)} className={`p-2 rounded-lg border ${!mobile ? 'bg-[#17181A] text-white border-[#17181A]' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`} title="Escritorio"><Monitor size={16} /></button>
          <button onClick={() => setMobile(true)} className={`p-2 rounded-lg border ${mobile ? 'bg-[#17181A] text-white border-[#17181A]' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`} title="Celular"><Smartphone size={16} /></button>
        </div>
      </div>

      {meta?.provider === 'log' && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <p>No hay proveedor de correo configurado en el servidor (RESEND_API_KEY o EMAIL_USER/EMAIL_PASS). Los correos se registran en consola pero no se envían.</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="glass-card p-3 space-y-1 self-start">
          {(meta?.templates || []).map((t) => (
            <button
              key={t.name}
              onClick={() => selectTemplate(t.name)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${selected === t.name ? 'bg-[#17181A] text-white' : 'hover:bg-white/70 text-[#17181A]'}`}
            >
              <div className="flex items-center gap-2">
                <Mail size={14} className={selected === t.name ? 'text-[#D7F653]' : 'text-gray-400'} />
                <span className="text-sm font-medium">{t.label}</span>
              </div>
              <p className={`text-[11px] mt-0.5 ml-6 ${selected === t.name ? 'text-white/60' : 'text-gray-400'}`}>Para: {t.audience}</p>
            </button>
          ))}
          {meta && (
            <div className="px-3 pt-3 mt-2 border-t border-gray-100 text-[11px] text-gray-400 space-y-1">
              <p>Proveedor: <span className="text-gray-600">{PROVIDER_LABEL[meta.provider] || meta.provider}</span></p>
              <p className="flex items-center gap-1.5">Acento: <span className="inline-block w-3 h-3 rounded-full border border-black/10" style={{ background: meta.brand?.accent }} /> <span className="text-gray-600">{meta.brand?.accent}</span></p>
              <p>Logo: <span className="text-gray-600">{meta.brand?.has_logo ? 'URL pública' : 'nombre en texto'}</span></p>
            </div>
          )}
        </div>

        <div className="glass-card p-4">
          {rendered ? (
            <>
              <div className="flex items-baseline gap-2 mb-3 px-1">
                <span className="text-xs uppercase tracking-wide text-gray-400">Asunto</span>
                <span className="text-sm font-medium text-[#17181A]">{rendered.subject}</span>
              </div>
              <div className="flex justify-center bg-[#F3F1ED] rounded-xl p-3">
                <iframe
                  title={`Vista previa ${selected}`}
                  srcDoc={rendered.html}
                  sandbox=""
                  className="bg-[#F3F1ED] rounded-lg border border-black/5 transition-all"
                  style={{ width: mobile ? 390 : '100%', height: 760 }}
                />
              </div>
            </>
          ) : (
            <div className="h-[760px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailTemplatesPreview;
