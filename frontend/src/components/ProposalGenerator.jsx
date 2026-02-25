import { useState, useEffect } from 'react';
import {
  X, Loader2, Check, ChevronRight, ChevronLeft, Sparkles, Copy,
  ExternalLink, FileText, Eye, Rocket, Wand2
} from 'lucide-react';
import { crmAPI } from '../utils/api';

export default function ProposalGenerator({ dealId, onClose, onProposalSent }) {
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customDescription, setCustomDescription] = useState('');
  const [variables, setVariables] = useState({});
  const [templateVars, setTemplateVars] = useState([]);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [deployResult, setDeployResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const STEPS = isCustom
    ? ['Elegir plantilla', 'Describir servicios', 'Vista previa', 'Publicar']
    : ['Elegir plantilla', 'Personalizar', 'Vista previa', 'Publicar'];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await crmAPI.getTemplates();
      setTemplates(res.data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setIsCustom(false);
    const vars = template.variables;
    const parsed = typeof vars === 'string' ? JSON.parse(vars) : vars;
    setTemplateVars(parsed || []);
    const initial = {};
    (parsed || []).forEach(v => { initial[v] = ''; });
    setVariables(initial);
  };

  const handleSelectCustom = () => {
    setSelectedTemplate(null);
    setIsCustom(true);
    setTemplateVars([]);
    setVariables({});
  };

  const handleAutoFill = async () => {
    setGenerating(true);
    try {
      const res = await crmAPI.generateProposal({
        deal_id: dealId,
        template_slug: selectedTemplate.slug,
        variables: {},
      });
      setVariables(res.data.variables || {});
      setTemplateVars(res.data.template_vars || templateVars);
    } catch (error) {
      console.error('Error auto-filling:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      if (isCustom) {
        const res = await crmAPI.generateCustomProposal({
          deal_id: dealId,
          services_description: customDescription,
        });
        setGeneratedHtml(res.data.html);
      } else {
        const res = await crmAPI.generateProposal({
          deal_id: dealId,
          template_slug: selectedTemplate.slug,
          variables,
        });
        setGeneratedHtml(res.data.html);
      }
      setStep(2);
    } catch (error) {
      console.error('Error generating:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeploy = async () => {
    if (!repoName.trim()) return;
    setDeploying(true);
    try {
      const res = await crmAPI.deployProposal({
        html: generatedHtml,
        repo_name: repoName,
        deal_id: dealId,
      });
      setDeployResult(res.data);
      if (onProposalSent) onProposalSent();
    } catch (error) {
      console.error('Error deploying:', error);
      alert(error.response?.data?.error || 'Error publicando propuesta');
    } finally {
      setDeploying(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(deployResult.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canProceedStep0 = selectedTemplate || isCustom;
  const canProceedStep1 = isCustom ? customDescription.trim().length > 0 : true;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A2E]">Generar Propuesta</h2>
            <div className="flex items-center gap-2 mt-2">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i <= step ? 'bg-[#1A1A2E] text-[#BFFF00]' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs ${i <= step ? 'text-[#1A1A2E] font-medium' : 'text-gray-400'} hidden sm:inline`}>
                    {s}
                  </span>
                  {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 0: Choose Template */}
          {step === 0 && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className={`text-left p-5 rounded-xl border-2 transition-all ${
                        selectedTemplate?.id === t.id
                          ? 'border-[#BFFF00] bg-[#BFFF00]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                        <FileText className="w-5 h-5 text-[#1A1A2E]" />
                      </div>
                      <h4 className="font-semibold text-[#1A1A2E] text-sm">{t.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                    </button>
                  ))}

                  {/* Custom option */}
                  <button
                    onClick={handleSelectCustom}
                    className={`text-left p-5 rounded-xl border-2 transition-all ${
                      isCustom
                        ? 'border-[#BFFF00] bg-[#BFFF00]/5'
                        : 'border-dashed border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                      isCustom ? 'bg-purple-100' : 'bg-gray-100'
                    }`}>
                      <Wand2 className={`w-5 h-5 ${isCustom ? 'text-purple-600' : 'text-gray-500'}`} />
                    </div>
                    <h4 className="font-semibold text-[#1A1A2E] text-sm">Personalizada</h4>
                    <p className="text-xs text-gray-500 mt-1">Describe los servicios y la IA genera la presentación completa</p>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Customize Variables OR Describe Services */}
          {step === 1 && !isCustom && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Personaliza las variables de la propuesta</p>
                <button
                  onClick={handleAutoFill}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Auto-llenar con IA
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templateVars.map((varName) => (
                  <div key={varName}>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      {varName.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      value={variables[varName] || ''}
                      onChange={(e) => setVariables({ ...variables, [varName]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                      placeholder={`{{${varName}}}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && isCustom && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Describe los servicios que incluirá la propuesta</p>
                <p className="text-xs text-gray-400">La IA usará la información del deal y los transcripts para personalizar la presentación</p>
              </div>
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Ej: CRM personalizado, Landing pages por servicio/destino, Formularios inteligentes que filtren leads, Metodología REAL para acompañamiento estratégico mensual..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00] resize-none"
                rows={6}
              />
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Wand2 className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-purple-900">Generación con IA</p>
                    <p className="text-xs text-purple-700 mt-1">
                      Claude generará una presentación completa con el estilo de LA REAL, incluyendo: portada personalizada, pain points del cliente, detalle de servicios, inversión y cierre. Basándose en toda la información del deal y transcripts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Vista previa de la propuesta generada</p>
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white" style={{ height: '500px' }}>
                <iframe
                  srcDoc={generatedHtml}
                  sandbox="allow-same-origin allow-scripts"
                  className="w-full h-full"
                  title="Vista previa de propuesta"
                />
              </div>
            </div>
          )}

          {/* Step 3: Deploy */}
          {step === 3 && (
            <div className="space-y-4">
              {!deployResult ? (
                <>
                  <p className="text-sm text-gray-500">Publica la propuesta en GitHub Pages</p>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre del repositorio</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">juanfelareal/</span>
                      <input
                        type="text"
                        value={repoName}
                        onChange={(e) => setRepoName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        placeholder="propuesta-cliente-xyz"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleDeploy}
                    disabled={deploying || !repoName.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium hover:bg-[#252542] disabled:opacity-50 w-full justify-center"
                  >
                    {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    Publicar en GitHub Pages
                  </button>
                </>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1A1A2E]">Propuesta publicada</h3>
                  <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-2">
                    <input
                      type="text"
                      value={deployResult.url}
                      readOnly
                      className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                    </button>
                    <a
                      href={deployResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-500" />
                    </a>
                  </div>
                  <p className="text-xs text-gray-400">La URL puede tardar unos minutos en estar activa</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-100">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancelar' : 'Atrás'}
          </button>

          {step === 0 && canProceedStep0 && (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium hover:bg-[#252542]"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 1 && (
            <button
              onClick={handleGenerate}
              disabled={generating || !canProceedStep1}
              className="flex items-center gap-1 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium hover:bg-[#252542] disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isCustom ? 'Generando presentación...' : 'Generando...'}
                </>
              ) : (
                <>
                  {isCustom ? <Wand2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {isCustom ? 'Generar con IA' : 'Generar Vista Previa'}
                </>
              )}
            </button>
          )}

          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium hover:bg-[#252542]"
            >
              Publicar <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && deployResult && (
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium hover:bg-[#252542]"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
