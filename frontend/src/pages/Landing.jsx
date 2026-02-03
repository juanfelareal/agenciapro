import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  CheckSquare,
  FileText,
  BarChart3,
  TrendingUp,
  Calendar,
  CreditCard,
  BookOpen,
  ArrowRight,
  Check,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Shield,
  Clock,
  Target,
} from 'lucide-react';

const Landing = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [openFAQ, setOpenFAQ] = useState(null);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 6);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: BarChart3,
      title: 'Tu centro de control',
      description: 'Widgets personalizables. Ve lo que importa, cuando importa. Dashboard ejecutivo en tiempo real.',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
    },
    {
      icon: FolderKanban,
      title: 'De la idea al pago',
      description: 'Kanban, timeline, presupuesto vs gastado. Cada proyecto conectado de inicio a fin.',
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-600',
    },
    {
      icon: CheckSquare,
      title: 'Todos saben qué hacer',
      description: 'Asigna, prioriza, trackea. Vista Kanban, lista o calendario. Subtareas y dependencias.',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
    },
    {
      icon: Clock,
      title: 'Cada minuto cuenta',
      description: 'Timer en vivo o entrada manual. Sabe dónde va tu tiempo y la rentabilidad real de cada proyecto.',
      iconBg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-600',
    },
    {
      icon: FileText,
      title: 'Cobra sin perseguir',
      description: 'Facturas automáticas, recordatorios de pago e integración con Siigo. Todo en piloto automático.',
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-600',
    },
    {
      icon: Users,
      title: 'Clientes felices',
      description: 'Portal de cliente con acceso controlado. Que vean avances y aprueben sin tener que preguntar.',
      iconBg: 'bg-rose-500/10',
      iconColor: 'text-rose-600',
    },
  ];

  const stats = [
    { value: '10+', label: 'Horas ahorradas/semana' },
    { value: '100%', label: 'Visibilidad financiera' },
    { value: '3x', label: 'Más productividad' },
    { value: '0', label: 'Facturas olvidadas' },
  ];

  // Orbit Logo SVG Component — matches app design system
  const OrbitLogoIcon = ({ size = 40, variant = 'dark' }) => {
    const color = variant === 'light' ? '#FFFFFF' : '#1A1A2E';
    const accent = '#BFFF00';

    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="16" stroke={color} strokeWidth="1.5" strokeOpacity="0.2" fill="none" />
        <ellipse cx="20" cy="20" rx="12" ry="16" transform="rotate(-30 20 20)" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
        <ellipse cx="20" cy="20" rx="8" ry="14" transform="rotate(30 20 20)" stroke={accent} strokeWidth="2" fill="none" />
        <circle cx="20" cy="20" r="4" fill={color} />
        <circle cx="32" cy="14" r="2.5" fill={accent} />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Gradients */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(191, 255, 0, 0.08) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%, rgba(26, 26, 46, 0.04) 0%, transparent 50%)
            `,
          }}
        />

        {/* Floating Orbital Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute w-96 h-96 rounded-full border opacity-[0.04]"
            style={{ top: '10%', right: '-10%', borderColor: '#1A1A2E', borderWidth: '2px' }}
          />
          <div
            className="absolute w-64 h-64 rounded-full border opacity-[0.06]"
            style={{ bottom: '20%', left: '-5%', borderColor: '#BFFF00', borderWidth: '2px' }}
          />
        </div>

        {/* Navigation */}
        <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <OrbitLogoIcon size={40} variant="dark" />
              <span className="text-xl font-semibold tracking-tight text-[#1A1A2E]" style={{ letterSpacing: '-0.02em' }}>
                Orbit
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-gray-500 hover:text-[#1A1A2E] transition-colors">
                Funciones
              </a>
              <a href="#faq" className="text-sm font-medium text-gray-500 hover:text-[#1A1A2E] transition-colors">
                FAQ
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="hidden sm:inline-flex text-sm font-medium px-4 py-2 rounded-xl text-[#1A1A2E] transition-all duration-150 hover:bg-gray-100"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/login"
                className="btn-lime text-sm font-medium px-5 py-2.5 rounded-xl transition-all duration-150 hover:scale-105"
              >
                Prueba gratis
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 badge-lime">
              <Sparkles size={16} />
              <span>Tu negocio en órbita todos los días</span>
            </div>

            {/* Headline */}
            <h1
              className="text-4xl md:text-6xl lg:text-7xl font-semibold text-[#1A1A2E] mb-6"
              style={{ letterSpacing: '-0.03em', lineHeight: '1.05' }}
            >
              Tu negocio
              <br />
              <span className="text-[#65A30D]">en órbita.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto text-gray-500" style={{ lineHeight: '1.6' }}>
              Clientes, proyectos, tareas, tiempo y facturación.
              Todo conectado en un solo lugar.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link
                to="/login"
                className="w-full sm:w-auto btn-dark inline-flex items-center justify-center gap-2 text-base font-medium px-8 py-4 rounded-xl transition-all duration-150 hover:scale-105"
              >
                Empieza gratis
                <ArrowRight size={18} />
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-medium px-8 py-4 rounded-xl bg-white border border-gray-200 text-[#1A1A2E] transition-all duration-150 hover:border-gray-300 hover:shadow-sm"
              >
                Ver cómo funciona
                <ChevronRight size={18} />
              </a>
            </div>

            {/* Trust Badges */}
            <p className="text-sm mb-12 text-gray-400">
              Sin tarjeta de crédito &bull; Setup en 2 minutos &bull; Soporte en español
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-[#1A1A2E] mb-1" style={{ letterSpacing: '-0.02em' }}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* App Preview */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)' }}>
            <div className="p-2">
              <div className="rounded-xl overflow-hidden bg-[#F8F9FA]" style={{ minHeight: '400px' }}>
                {/* Mock Dashboard */}
                <div className="flex">
                  {/* Sidebar Mock */}
                  <div className="w-56 p-4 hidden md:block bg-white border-r border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                      <OrbitLogoIcon size={32} variant="dark" />
                      <span className="font-semibold text-sm text-[#1A1A2E]">Orbit</span>
                    </div>
                    <div className="space-y-1">
                      {['Dashboard', 'Clientes', 'Proyectos', 'Tareas', 'Facturas', 'Reportes'].map((item, i) => (
                        <div
                          key={item}
                          className="px-3 py-2 rounded-xl text-sm"
                          style={{
                            background: i === 0 ? '#1A1A2E' : 'transparent',
                            color: i === 0 ? '#BFFF00' : '#6B7280',
                          }}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Content Mock */}
                  <div className="flex-1 p-6">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-1 text-[#1A1A2E]">Dashboard</h3>
                      <p className="text-sm text-gray-500">Resumen general de la agencia</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {[
                        { label: 'Clientes activos', value: '24', trend: '+12%' },
                        { label: 'Proyectos', value: '12', trend: '+5%' },
                        { label: 'Tareas pendientes', value: '38', trend: '-8%' },
                        { label: 'Ingresos mes', value: '$45,200', trend: '+23%' },
                      ].map((metric, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-white border border-gray-100">
                          <div className="flex items-end justify-between mb-1">
                            <span className="text-2xl font-semibold text-[#1A1A2E]">{metric.value}</span>
                            <span className={`text-xs font-medium ${metric.trend.startsWith('+') ? 'text-green-500' : 'text-amber-500'}`}>
                              {metric.trend}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">{metric.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Chart placeholder */}
                    <div className="rounded-2xl p-4 h-32 bg-white border border-gray-100">
                      <div className="flex items-end justify-between h-full gap-2">
                        {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 80].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t-lg transition-all duration-500"
                            style={{
                              height: `${h}%`,
                              background: i === 11 ? '#BFFF00' : `rgba(191, 255, 0, ${0.15 + (h / 300)})`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold text-[#1A1A2E] mb-4" style={{ letterSpacing: '-0.02em' }}>
              ¿Suena familiar?
            </h2>
            <p className="text-lg max-w-2xl mx-auto text-gray-500">
              Si tu día a día se parece a esto, Orbit es para ti.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { emoji: '😵‍💫', title: '¿Perdido entre Excel, Trello y WhatsApp?', description: 'Información regada en 5 herramientas diferentes. Nadie sabe dónde está nada.' },
              { emoji: '⏱️', title: '¿No sabes cuántas horas reales inviertes en cada cliente?', description: 'Sin control de tiempo, es imposible saber si un proyecto es rentable o no.' },
              { emoji: '💸', title: '¿Tus facturas llegan tarde (o nunca)?', description: 'Facturación manual, olvidos constantes y flujo de caja impredecible.' },
              { emoji: '😤', title: '¿Tu equipo no sabe en qué enfocarse hoy?', description: 'Sin prioridades claras, cada quien hace lo que cree más urgente.' },
            ].map((pain, index) => (
              <div key={index} className="p-6 rounded-2xl bg-white border border-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="text-3xl mb-3">{pain.emoji}</div>
                <h3 className="text-lg font-semibold mb-2 text-[#1A1A2E]">{pain.title}</h3>
                <p className="text-sm text-gray-500">{pain.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold text-[#1A1A2E] mb-4" style={{ letterSpacing: '-0.02em' }}>
              Todo lo que necesitas
              <br />
              <span className="text-[#65A30D]">en una sola órbita</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto text-gray-500">
              Una suite completa para gestionar clientes, proyectos, tareas, tiempo y facturación.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className={`p-6 rounded-2xl transition-all duration-300 cursor-pointer bg-white border ${
                    activeFeature === index ? 'border-[#BFFF00] shadow-lg -translate-y-1' : 'border-gray-100 hover:border-gray-200'
                  }`}
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <div className={`w-11 h-11 ${feature.iconBg} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon size={22} className={feature.iconColor} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-[#1A1A2E]" style={{ letterSpacing: '-0.01em' }}>
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500">{feature.description}</p>
                </div>
              );
            })}
          </div>

          {/* Additional Features List */}
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Calendar, text: 'Calendario integrado' },
              { icon: CreditCard, text: 'Control de gastos' },
              { icon: BookOpen, text: 'SOPs y documentación' },
              { icon: Target, text: 'Métricas de clientes' },
              { icon: Shield, text: 'Permisos por rol' },
              { icon: Clock, text: 'Tareas recurrentes' },
              { icon: TrendingUp, text: 'Dashboard ejecutivo' },
              { icon: Sparkles, text: 'Notificaciones inteligentes' },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                  <Icon size={18} className="text-[#65A30D]" />
                  <span className="text-sm font-medium text-[#1A1A2E]">{item.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 relative overflow-hidden bg-[#1A1A2E]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[600px] h-[600px] rounded-full border opacity-10" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', borderColor: '#BFFF00', borderWidth: '1px' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full border opacity-10" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(30deg)', borderColor: '#FFFFFF', borderWidth: '1px' }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
              ¿Cómo funciona
              <br />
              <span className="text-[#BFFF00]">Orbit?</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto text-white/60">
              Tres pasos para poner tu negocio en órbita. Sin complicaciones.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Crea tu cuenta', description: '2 minutos, sin tarjeta. Agrega tu equipo, define roles y permisos.' },
              { step: '02', title: 'Importa o crea', description: 'Clientes, proyectos, equipo. Importa desde CSV o crea desde cero con plantillas.' },
              { step: '03', title: 'Trabaja mejor', description: 'Todo conectado, automático. Enfócate en lo que importa: hacer crecer tu negocio.' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6" style={{ background: 'rgba(191, 255, 0, 0.15)', border: '1px solid rgba(191, 255, 0, 0.3)' }}>
                  <span className="text-2xl font-semibold text-[#BFFF00]">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-white/60">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Who Section */}
      <section className="py-24 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold text-[#1A1A2E] mb-4" style={{ letterSpacing: '-0.02em' }}>
              ¿Para quién es
              <br />
              <span className="text-[#65A30D]">Orbit?</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="p-8 rounded-2xl bg-white border border-gray-100">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-3 text-[#1A1A2E]">Agencias Digitales</h3>
              <p className="text-sm mb-4 text-gray-500">
                Marketing, diseño, desarrollo, consultoría. Si manejas múltiples clientes y proyectos, Orbit es tu centro de control.
              </p>
              <ul className="space-y-2">
                {['CRM + Proyectos + Facturación', 'Control de horas y rentabilidad', 'Portal para tus clientes', 'Facturación automática'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check size={14} className="text-[#65A30D]" />
                    <span className="text-sm text-[#1A1A2E]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-8 rounded-2xl bg-white border border-gray-100">
              <div className="text-4xl mb-4">🏢</div>
              <h3 className="text-xl font-semibold mb-3 text-[#1A1A2E]">Equipos y Empresas</h3>
              <p className="text-sm mb-4 text-gray-500">
                Startups, PyMEs, departamentos internos. Si necesitas organizar proyectos y equipos, Orbit te simplifica la vida.
              </p>
              <ul className="space-y-2">
                {['Tareas Kanban y calendario', 'Asignaciones y carga de trabajo', 'Dashboard con métricas reales', 'Colaboración sin fricciones'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check size={14} className="text-[#65A30D]" />
                    <span className="text-sm text-[#1A1A2E]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold text-[#1A1A2E] mb-4" style={{ letterSpacing: '-0.02em' }}>
              Preguntas
              <br />
              <span className="text-[#65A30D]">frecuentes</span>
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { q: '¿Puedo probarlo gratis?', a: 'Sí. Puedes crear tu cuenta y empezar a usar Orbit sin costo. No necesitas tarjeta de crédito.' },
              { q: '¿Hay límite de usuarios?', a: 'Depende del plan. El plan gratuito incluye hasta 5 usuarios. Planes pagos permiten equipos más grandes.' },
              { q: '¿Funciona en móvil?', a: 'Sí. Orbit es completamente responsive y funciona en cualquier dispositivo con navegador web.' },
              { q: '¿Puedo importar mis datos de otras herramientas?', a: 'Sí. Puedes importar clientes, proyectos y tareas desde CSV o conectar directamente con otras plataformas.' },
              { q: '¿Qué tan segura es mi información?', a: 'Usamos encriptación de extremo a extremo, backups automáticos y servidores seguros. Tu información está protegida.' },
              { q: '¿Ofrecen soporte en español?', a: 'Sí. Todo nuestro soporte es en español. Respondemos en menos de 24 horas hábiles.' },
            ].map((faq, index) => (
              <div key={index} className="rounded-2xl overflow-hidden bg-white border border-gray-100 transition-all duration-200">
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-medium text-[#1A1A2E]">{faq.q}</span>
                  <ChevronDown
                    size={20}
                    className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${openFAQ === index ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFAQ === index && (
                  <div className="px-5 pb-5">
                    <p className="text-sm leading-relaxed text-gray-500">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(191, 255, 0, 0.06) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[300px] h-[300px] rounded-full border opacity-[0.06]" style={{ top: '50%', left: '20%', transform: 'translateY(-50%)', borderColor: '#BFFF00', borderWidth: '2px' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex mb-8">
            <OrbitLogoIcon size={64} variant="dark" />
          </div>
          <h2 className="text-3xl md:text-5xl font-semibold text-[#1A1A2E] mb-6" style={{ letterSpacing: '-0.02em' }}>
            ¿Listo para dejar
            <br />
            <span className="text-[#65A30D]">el caos atrás?</span>
          </h2>
          <p className="text-lg mb-10 max-w-xl mx-auto text-gray-500">
            Empieza hoy. Tu yo del futuro te lo agradecerá.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto btn-dark inline-flex items-center justify-center gap-2 text-base font-medium px-8 py-4 rounded-xl transition-all duration-150 hover:scale-105"
            >
              Crear cuenta gratis
              <ArrowRight size={18} />
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-medium px-8 py-4 rounded-xl bg-white border border-gray-200 text-[#1A1A2E] transition-all duration-150 hover:border-gray-300 hover:shadow-sm"
            >
              Ver cómo funciona
              <ChevronRight size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-[#1A1A2E]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <OrbitLogoIcon size={40} variant="light" />
                <span className="text-xl font-semibold tracking-tight text-white">Orbit</span>
              </div>
              <p className="text-sm text-white/60">
                La plataforma todo-en-uno para gestionar tu negocio.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Producto</h4>
              <ul className="space-y-2">
                {['Funciones', 'Changelog'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-white/60 hover:text-[#BFFF00] transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Recursos</h4>
              <ul className="space-y-2">
                {['Documentación', 'Blog', 'Guías', 'Soporte'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-white/60 hover:text-[#BFFF00] transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                {['Privacidad', 'Términos', 'Cookies'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-white/60 hover:text-[#BFFF00] transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10">
            <p className="text-sm text-white/40">© 2026 Orbit. Todos los derechos reservados.</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/40">Hecho con</span>
              <span className="text-[#BFFF00]">♥</span>
              <span className="text-sm text-white/40">en LATAM</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Styles */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Landing;
