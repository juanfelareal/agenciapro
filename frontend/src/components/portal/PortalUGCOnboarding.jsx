import { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  ShoppingBag,
  BarChart3,
  Video,
  Users,
  Package,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Rocket
} from 'lucide-react';

// Meta logo SVG
const MetaLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02Z"/>
  </svg>
);

// Shopify logo SVG
const ShopifyLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M15.34 3.55c-.01-.07-.07-.12-.12-.13a.44.44 0 0 0-.2 0s-1.67.5-2.21.66c-.13-.4-.36-.86-.7-1.33C11.47 1.9 10.64 1.5 9.67 1.5c-.1 0-.2 0-.3.02-.05-.06-.1-.12-.16-.17C8.63.79 7.9.55 7.05.6c-1.6.1-3.2 1.21-4.5 3.13C1.35 5.47.5 7.44.2 8.95c-.66 3.47 2.77 5.32 2.77 5.32l.02.01 1.5.47c.35 1.07 1.2 3.63 1.2 3.63.14.43.52.66.92.66h.01c.34 0 .67-.16.86-.47l1.81-2.22c1.95.72 4.15.52 5.8-.63l.02-.02c2.26-1.6 2.91-4.5 2.23-7.32-.68-2.83-1.93-4.55-1.98-4.63l-.02-.2zM9.4 2.1c.72 0 1.23.35 1.6.77.11.12.2.25.28.38-.92.28-1.93.58-2.96.9.36-1.25.87-1.96 1.08-2.05zm-3.7 1.11c.04 0 .08 0 .12.01.17.04.33.14.47.27-.16.06-1.37.42-2.8.87.54-1.1 1.43-2.08 2.21-2.15zm-.08 9.14l-2.06-.64s-1.4-.94-1.04-2.84c.14-.73.67-2.13 1.53-3.52.5-.81 1.1-1.54 1.72-2.1 0 0 0 .01.01.01l-.16 9.1zm5.31 4.52l-1.4 1.72-1-3.08 2.4 1.36zm3.84-4.93c-1.23.87-2.92 1.02-4.5.5l-.15-.05.2-11.02c.24-.07 1.99-.6 2.91-.87 0 0 .01.01.02.02.25.37 1.21 1.84 1.74 3.95.5 2 .3 4.6-2.22 7.47z"/>
  </svg>
);

export default function PortalUGCOnboarding({ onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  const META_PORTFOLIO_ID = '296738006188402';

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const steps = [
    { id: 'welcome', label: 'Bienvenida', icon: Sparkles },
    { id: 'meta', label: 'Conexión Meta', icon: MetaLogo },
    { id: 'shopify', label: 'Conexión Shopify', icon: ShopifyLogo },
    { id: 'platform', label: 'Tu plataforma', icon: Video },
  ];

  const shopifySteps = [
    {
      step: 1,
      title: 'Accede a tu panel de Shopify',
      description: 'Inicia sesión en tu tienda Shopify y ve a Configuración (ícono de engranaje).',
    },
    {
      step: 2,
      title: 'Ve a Usuarios → Seguridad',
      description: 'En el menú lateral, selecciona "Usuarios" y luego haz clic en "Seguridad".',
    },
    {
      step: 3,
      title: 'Genera el código de colaborador',
      description: 'En la sección "Colaboradores", haz clic en "Generar código nuevo". Aparecerá un código de 4 dígitos.',
    },
    {
      step: 4,
      title: 'Comparte el código con nosotros',
      description: 'Copia el código de 4 dígitos y envíanoslo por WhatsApp o email. Con ese código solicitaremos acceso desde nuestro panel de Shopify Partners.',
    },
    {
      step: 5,
      title: 'Aprueba nuestra solicitud',
      description: 'Recibirás una notificación de solicitud de colaborador. Ve a Configuración → Usuarios y aprueba el acceso de LA REAL Marketing.',
    },
  ];

  const platformFeatures = [
    {
      icon: Users,
      title: 'Creadores asignados',
      description: 'Aquí verás todos los creadores de contenido UGC que hemos seleccionado y asignado para tu marca.',
    },
    {
      icon: Package,
      title: 'Seguimiento de entregas',
      description: 'Podrás ver el estado de cada asignación: en producción, entregado, etc. Todo en tiempo real.',
    },
    {
      icon: Video,
      title: 'Acceso a contenido',
      description: 'Cuando los creadores entreguen su contenido, tendrás acceso directo a los archivos desde esta plataforma.',
    },
    {
      icon: BarChart3,
      title: 'Métricas de rendimiento',
      description: 'Próximamente: verás cómo performa el contenido UGC en tus campañas de pauta.',
    },
  ];

  const faqs = [
    {
      q: '¿Por qué necesitan acceso a Meta?',
      a: 'Para poder gestionar y optimizar tus campañas de pauta digital, necesitamos ser agregados como partners en tu Business Manager. Esto nos permite ver métricas, crear audiencias y gestionar el contenido UGC en tus anuncios.',
    },
    {
      q: '¿Qué datos ven de mi Shopify?',
      a: 'Solo accedemos a datos de lectura: pedidos, productos, analíticas y clientes. Esto nos permite medir el impacto real del contenido UGC en tus ventas y optimizar las campañas. Nunca modificamos nada en tu tienda.',
    },
    {
      q: '¿Cuánto tarda el proceso de conexión?',
      a: 'Una vez nos envíes las invitaciones (Meta y Shopify), aceptamos en menos de 24 horas hábiles. Te notificaremos cuando todo esté listo.',
    },
  ];

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Welcome
        return (
          <div className="text-center max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-[#17181A] mb-4">
              ¡Bienvenido al programa UGC!
            </h2>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              Estamos emocionados de trabajar contigo para <span className="font-semibold text-violet-600">hacer crecer tu marca</span> con contenido auténtico creado por personas reales.
            </p>
            <p className="text-gray-500 mb-8">
              El contenido UGC (User Generated Content) es una de las formas más efectivas de conectar con tu audiencia.
              Nuestro equipo seleccionará creadores que representen tu marca y crearán contenido que resuene con tus clientes potenciales.
            </p>
            <div className="bg-violet-50 rounded-2xl p-6 text-left">
              <h3 className="font-semibold text-violet-900 mb-3">Lo que haremos por ti:</h3>
              <ul className="space-y-2">
                {[
                  'Seleccionar creadores que encajen con tu marca',
                  'Gestionar todo el proceso de creación de contenido',
                  'Optimizar el contenido para tus campañas de pauta',
                  'Medir el impacto real en tus ventas',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-violet-800">
                    <CheckCircle2 className="w-5 h-5 text-violet-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      case 1: // Meta
        return (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                <MetaLogo />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#17181A]">Conexión con Meta</h2>
                <p className="text-gray-500">Paso 1 de 2 conexiones</p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">¿Por qué necesitamos esto?</h3>
              <p className="text-blue-800">
                Para gestionar tus campañas de pauta en Facebook e Instagram con el contenido UGC,
                necesitamos ser partners de tu cuenta de Meta Business. Esto nos permite optimizar
                tus anuncios y medir el rendimiento del contenido.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-semibold text-[#17181A] mb-4">Pasos para agregarnos:</h3>

              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                  <div>
                    <p className="font-medium text-gray-900">Accede a Meta Business Suite</p>
                    <p className="text-sm text-gray-500">
                      Ve a{' '}
                      <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        business.facebook.com/settings <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                  <div>
                    <p className="font-medium text-gray-900">Ve a Configuración del negocio → Partners</p>
                    <p className="text-sm text-gray-500">En el menú lateral izquierdo, busca "Partners" o "Socios"</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                  <div>
                    <p className="font-medium text-gray-900">Agregar partner</p>
                    <p className="text-sm text-gray-500">Haz clic en "Agregar" y selecciona "Dar acceso a un partner"</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                  <div>
                    <p className="font-medium text-gray-900">Ingresa nuestro ID de portafolio</p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="bg-gray-100 px-4 py-2 rounded-lg font-mono text-lg text-gray-900">
                        {META_PORTFOLIO_ID}
                      </code>
                      <button
                        onClick={() => copyToClipboard(META_PORTFOLIO_ID)}
                        className={`p-2 rounded-lg transition-colors ${copiedId ? 'bg-green-100 text-green-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                      >
                        {copiedId ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
                  <div>
                    <p className="font-medium text-gray-900">Asigna los activos</p>
                    <p className="text-sm text-gray-500">
                      Selecciona tu página de Facebook, cuenta de Instagram y cuenta publicitaria.
                      Asigna permisos de "Gestionar campañas" o acceso completo.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        );

      case 2: // Shopify
        return (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#17181A]">Conexión con Shopify</h2>
                <p className="text-gray-500">Paso 2 de 2 conexiones</p>
              </div>
            </div>

            <div className="bg-green-50 rounded-2xl p-6 mb-6">
              <h3 className="font-semibold text-green-900 mb-2">¿Por qué necesitamos esto?</h3>
              <p className="text-green-800">
                Con acceso de <span className="font-semibold">solo lectura</span> a tu Shopify,
                podemos medir el impacto real del contenido UGC en tus ventas.
                Esto nos permite optimizar las campañas basándonos en datos reales de conversión.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-900">Somos Shopify Partners oficiales</p>
                <p className="text-sm text-amber-700">
                  Cumplimos con todos los estándares de seguridad y privacidad de Shopify.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-semibold text-[#17181A] mb-4">Pasos para darnos acceso:</h3>

              <ol className="space-y-4">
                {shopifySteps.map((item) => (
                  <li key={item.step} className="flex gap-4">
                    <span className="w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {item.step}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-6 pt-6 border-t border-gray-100 bg-green-50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
                <p className="text-sm text-green-800 flex items-center gap-2">
                  <span className="font-semibold">💡 Tip:</span>
                  El código de 4 dígitos es temporal y seguro. Solo funciona para que LA REAL solicite acceso como colaborador.
                </p>
              </div>
            </div>
          </div>
        );

      case 3: // Platform
        return (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-violet-600" />
              </div>
              <h2 className="text-2xl font-bold text-[#17181A] mb-2">Tu plataforma UGC</h2>
              <p className="text-gray-500">
                Desde aquí podrás ver todo lo relacionado con el contenido UGC de tu marca
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {platformFeatures.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-violet-600" />
                    </div>
                    <h3 className="font-semibold text-[#17181A] mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-500">{feature.description}</p>
                  </div>
                );
              })}
            </div>

            {/* FAQs */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="font-semibold text-[#17181A] mb-4">Preguntas frecuentes</h3>
              <div className="space-y-2">
                {faqs.map((faq, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium text-gray-900">{faq.q}</span>
                      {expandedFaq === i ? (
                        <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {expandedFaq === i && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-gray-600">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Progress Steps */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === activeStep;
            const isComplete = i < activeStep;
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setActiveStep(i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-violet-100 text-violet-700'
                      : isComplete
                      ? 'bg-green-50 text-green-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive
                      ? 'bg-violet-600 text-white'
                      : isComplete
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100'
                  }`}>
                    {isComplete ? <Check className="w-4 h-4" /> : <Icon />}
                  </div>
                  <span className="font-medium text-sm hidden sm:inline">{step.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${i < activeStep ? 'bg-green-300' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
          disabled={activeStep === 0}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Anterior
        </button>

        <div className="flex items-center gap-3">
          {activeStep < steps.length - 1 ? (
            <button
              onClick={() => setActiveStep(activeStep + 1)}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#17181A] text-white rounded-xl hover:bg-[#26282C] transition-colors font-medium"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium"
            >
              <CheckCircle2 className="w-4 h-4" />
              Comenzar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
