import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  CheckSquare,
  FileText,
  BarChart3,
  Zap,
  TrendingUp,
  Calendar,
  CreditCard,
  BookOpen,
  ArrowRight,
  Check,
  Play,
  Star,
  ChevronRight,
  Sparkles,
  Shield,
  Clock,
  Target,
} from 'lucide-react';
import OrbitLogo, { OrbitLogoAnimated } from '../components/OrbitLogo';

const Landing = () => {
  const [activeFeature, setActiveFeature] = useState(0);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 6);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: Users,
      title: 'Gestion de Clientes',
      description: 'Centraliza toda la informacion de tus clientes, contratos y facturacion recurrente en un solo lugar.',
      color: '#22C55E',
    },
    {
      icon: FolderKanban,
      title: 'Proyectos & Plantillas',
      description: 'Crea proyectos desde plantillas predefinidas. Controla presupuestos y rentabilidad en tiempo real.',
      color: '#F59E0B',
    },
    {
      icon: CheckSquare,
      title: 'Tareas Inteligentes',
      description: 'Kanban, subtareas, dependencias, tareas recurrentes y asignacion por equipo.',
      color: '#8B5CF6',
    },
    {
      icon: FileText,
      title: 'Facturacion Automatica',
      description: 'Genera facturas automaticamente para clientes recurrentes. Seguimiento de pagos incluido.',
      color: '#EC4899',
    },
    {
      icon: BarChart3,
      title: 'Reportes Avanzados',
      description: 'Dashboards ejecutivos con metricas de rentabilidad, productividad y desempeno financiero.',
      color: '#06B6D4',
    },
    {
      icon: Zap,
      title: 'Automatizaciones',
      description: 'Automatiza flujos de trabajo: cambios de estado, asignaciones, notificaciones y mas.',
      color: '#F43F5E',
    },
  ];

  const testimonials = [
    {
      quote: 'Orbit transformo como manejamos nuestra agencia. Antes usabamos 5 herramientas diferentes, ahora todo esta en un solo lugar.',
      author: 'Maria Garcia',
      role: 'CEO, Digital Masters',
      avatar: 'MG',
    },
    {
      quote: 'La facturacion automatica nos ahorra 10 horas al mes. El ROI fue inmediato.',
      author: 'Carlos Rodriguez',
      role: 'Director, CreativeHub',
      avatar: 'CR',
    },
    {
      quote: 'Por fin puedo ver la rentabilidad real de cada proyecto. Decisiones basadas en datos, no intuicion.',
      author: 'Ana Martinez',
      role: 'Fundadora, MediaPro',
      avatar: 'AM',
    },
  ];

  const stats = [
    { value: '10+', label: 'Horas ahorradas/semana' },
    { value: '100%', label: 'Visibilidad financiera' },
    { value: '3x', label: 'Mas productividad' },
    { value: '0', label: 'Facturas olvidadas' },
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: '49',
      period: '/mes',
      description: 'Perfecto para freelancers y equipos pequenos',
      features: [
        'Hasta 5 usuarios',
        'Gestion de clientes ilimitada',
        'Proyectos y tareas',
        'Facturacion basica',
        'Soporte por email',
      ],
      cta: 'Comenzar gratis',
      popular: false,
    },
    {
      name: 'Professional',
      price: '99',
      period: '/mes',
      description: 'Para agencias en crecimiento',
      features: [
        'Hasta 15 usuarios',
        'Todo de Starter +',
        'Facturacion automatica',
        'Integraciones (Shopify, FB Ads)',
        'Reportes avanzados',
        'Automatizaciones',
        'Soporte prioritario',
      ],
      cta: 'Prueba 14 dias gratis',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'Para agencias grandes con necesidades especificas',
      features: [
        'Usuarios ilimitados',
        'Todo de Professional +',
        'API personalizada',
        'Integraciones custom',
        'Onboarding dedicado',
        'SLA garantizado',
        'Account manager',
      ],
      cta: 'Contactar ventas',
      popular: false,
    },
  ];

  // Orbit Logo SVG Component
  const OrbitLogoIcon = ({ size = 40, variant = 'dark' }) => {
    const color = variant === 'light' ? '#FFFFFF' : '#1A1A1A';
    const accent = '#22C55E';

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer orbital ring */}
        <circle
          cx="20"
          cy="20"
          r="16"
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity="0.2"
          fill="none"
        />
        {/* Middle orbital ring - tilted */}
        <ellipse
          cx="20"
          cy="20"
          rx="12"
          ry="16"
          transform="rotate(-30 20 20)"
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity="0.4"
          fill="none"
        />
        {/* Inner orbital ring - accent */}
        <ellipse
          cx="20"
          cy="20"
          rx="8"
          ry="14"
          transform="rotate(30 20 20)"
          stroke={accent}
          strokeWidth="2"
          fill="none"
        />
        {/* Central core */}
        <circle cx="20" cy="20" r="4" fill={color} />
        {/* Orbiting dot */}
        <circle cx="32" cy="14" r="2.5" fill={accent} />
      </svg>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: '#FFFDF9' }}>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Gradients */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34, 197, 94, 0.12) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%, rgba(251, 191, 36, 0.08) 0%, transparent 50%),
              radial-gradient(ellipse 50% 30% at 20% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)
            `,
          }}
        />

        {/* Floating Orbital Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute w-96 h-96 rounded-full border opacity-[0.03]"
            style={{
              top: '10%',
              right: '-10%',
              borderColor: '#1A1A1A',
              borderWidth: '2px',
            }}
          />
          <div
            className="absolute w-64 h-64 rounded-full border opacity-[0.05]"
            style={{
              bottom: '20%',
              left: '-5%',
              borderColor: '#22C55E',
              borderWidth: '2px',
            }}
          />
        </div>

        {/* Navigation */}
        <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <OrbitLogoIcon size={40} variant="dark" />
              <span
                className="text-xl font-semibold tracking-tight"
                style={{ color: '#1A1A1A', letterSpacing: '-0.02em' }}
              >
                Orbit
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium transition-colors" style={{ color: '#6B6B6B' }}>
                Funciones
              </a>
              <a href="#integrations" className="text-sm font-medium transition-colors" style={{ color: '#6B6B6B' }}>
                Integraciones
              </a>
              <a href="#pricing" className="text-sm font-medium transition-colors" style={{ color: '#6B6B6B' }}>
                Precios
              </a>
              <a href="#testimonials" className="text-sm font-medium transition-colors" style={{ color: '#6B6B6B' }}>
                Testimonios
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="hidden sm:inline-flex text-sm font-medium px-4 py-2 rounded-xl transition-all duration-150 hover:bg-black/5"
                style={{ color: '#1A1A1A' }}
              >
                Iniciar sesion
              </Link>
              <Link
                to="/"
                className="text-sm font-medium px-5 py-2.5 rounded-xl text-white transition-all duration-150 hover:scale-105"
                style={{ background: '#1A1A1A', boxShadow: '0 2px 8px rgba(26, 26, 26, 0.15)' }}
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
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8"
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#16A34A',
                border: '1px solid rgba(34, 197, 94, 0.2)',
              }}
            >
              <Sparkles size={16} />
              <span>La plataforma #1 para agencias en LATAM</span>
            </div>

            {/* Headline */}
            <h1
              className="text-4xl md:text-6xl lg:text-7xl font-semibold mb-6"
              style={{
                color: '#1A1A1A',
                letterSpacing: '-0.03em',
                lineHeight: '1.05',
              }}
            >
              Tu agencia.
              <br />
              <span style={{ color: '#22C55E' }}>En orbita.</span>
            </h1>

            {/* Subheadline */}
            <p
              className="text-lg md:text-xl mb-10 max-w-2xl mx-auto"
              style={{ color: '#6B6B6B', lineHeight: '1.6' }}
            >
              Orbit unifica clientes, proyectos, tareas, facturacion y reportes en una sola plataforma.
              Todo sincronizado. Todo bajo control.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-medium px-8 py-4 rounded-xl text-white transition-all duration-150 hover:scale-105"
                style={{ background: '#1A1A1A', boxShadow: '0 4px 12px rgba(26, 26, 26, 0.2)' }}
              >
                Comenzar gratis
                <ArrowRight size={18} />
              </Link>
              <button
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-medium px-8 py-4 rounded-xl transition-all duration-150 hover:bg-white"
                style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  color: '#1A1A1A',
                }}
              >
                <Play size={18} />
                Ver demo
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div
                    className="text-3xl md:text-4xl font-semibold mb-1"
                    style={{ color: '#1A1A1A', letterSpacing: '-0.02em' }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-sm" style={{ color: '#6B6B6B' }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* App Preview */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="p-2">
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: '#FFFDF9', minHeight: '400px' }}
              >
                {/* Mock Dashboard */}
                <div className="flex">
                  {/* Sidebar Mock */}
                  <div
                    className="w-56 p-4 hidden md:block"
                    style={{ background: 'rgba(255, 255, 255, 0.9)', borderRight: '1px solid rgba(0, 0, 0, 0.06)' }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <OrbitLogoIcon size={32} variant="dark" />
                      <span className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Orbit</span>
                    </div>
                    <div className="space-y-1">
                      {['Dashboard', 'Clientes', 'Proyectos', 'Tareas', 'Facturas', 'Reportes'].map((item, i) => (
                        <div
                          key={item}
                          className="px-3 py-2 rounded-lg text-sm"
                          style={{
                            background: i === 0 ? '#1A1A1A' : 'transparent',
                            color: i === 0 ? 'white' : '#6B6B6B',
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
                      <h3 className="text-lg font-semibold mb-1" style={{ color: '#1A1A1A' }}>Dashboard</h3>
                      <p className="text-sm" style={{ color: '#6B6B6B' }}>Todo en orbita</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {[
                        { label: 'Clientes activos', value: '24', trend: '+12%' },
                        { label: 'Proyectos', value: '12', trend: '+5%' },
                        { label: 'Tareas pendientes', value: '38', trend: '-8%' },
                        { label: 'Ingresos mes', value: '$45,200', trend: '+23%' },
                      ].map((metric, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-2xl"
                          style={{
                            background: 'rgba(255, 255, 255, 0.8)',
                            border: '1px solid rgba(0, 0, 0, 0.04)',
                          }}
                        >
                          <div className="flex items-end justify-between mb-1">
                            <span className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>
                              {metric.value}
                            </span>
                            <span
                              className="text-xs font-medium"
                              style={{ color: metric.trend.startsWith('+') ? '#22C55E' : '#F59E0B' }}
                            >
                              {metric.trend}
                            </span>
                          </div>
                          <div className="text-xs" style={{ color: '#6B6B6B' }}>{metric.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Chart placeholder */}
                    <div
                      className="rounded-2xl p-4 h-32"
                      style={{
                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                        border: '1px solid rgba(0, 0, 0, 0.04)',
                      }}
                    >
                      <div className="flex items-end justify-between h-full gap-2">
                        {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 80].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t-lg transition-all duration-500"
                            style={{
                              height: `${h}%`,
                              background: i === 11
                                ? '#22C55E'
                                : `rgba(34, 197, 94, ${0.2 + (h / 200)})`,
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

      {/* Logos Marquee */}
      <section className="py-12 overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
        <div className="text-center mb-8">
          <p className="text-sm font-medium" style={{ color: '#6B6B6B' }}>
            Agencias de toda LATAM confian en Orbit
          </p>
        </div>
        <div className="relative">
          <div className="flex gap-12 animate-marquee">
            {[...Array(2)].map((_, setIndex) => (
              <div key={setIndex} className="flex gap-12 items-center shrink-0">
                {['Digital Masters', 'CreativeHub', 'MediaPro', 'GrowthLab', 'BrandStudio', 'AdFactory', 'PixelPerfect', 'WebCraft'].map((name, i) => (
                  <div
                    key={`${setIndex}-${i}`}
                    className="text-xl font-semibold px-6"
                    style={{ color: '#B3B3B3', whiteSpace: 'nowrap' }}
                  >
                    {name}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 40% at 20% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)`,
          }}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2
              className="text-3xl md:text-5xl font-semibold mb-4"
              style={{ color: '#1A1A1A', letterSpacing: '-0.02em' }}
            >
              Todo lo que necesitas
              <br />
              <span style={{ color: '#22C55E' }}>en una sola orbita</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: '#6B6B6B' }}>
              Una suite completa de herramientas disenadas especificamente para agencias digitales y de marketing.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="p-6 rounded-3xl transition-all duration-300 cursor-pointer group"
                  style={{
                    background: activeFeature === index ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)',
                    backdropFilter: 'blur(12px)',
                    border: activeFeature === index ? `2px solid ${feature.color}30` : '1px solid rgba(255, 255, 255, 0.8)',
                    boxShadow: activeFeature === index ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 2px 8px rgba(0, 0, 0, 0.02)',
                    transform: activeFeature === index ? 'translateY(-4px)' : 'none',
                  }}
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
                    style={{
                      background: `${feature.color}15`,
                      color: feature.color,
                    }}
                  >
                    <Icon size={24} />
                  </div>
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={{ color: '#1A1A1A', letterSpacing: '-0.01em' }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6B6B6B' }}>
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Additional Features List */}
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Calendar, text: 'Calendario integrado' },
              { icon: CreditCard, text: 'Control de gastos' },
              { icon: BookOpen, text: 'SOPs y documentacion' },
              { icon: Target, text: 'Metricas de clientes' },
              { icon: Shield, text: 'Permisos por rol' },
              { icon: Clock, text: 'Tareas recurrentes' },
              { icon: TrendingUp, text: 'Dashboard ejecutivo' },
              { icon: Sparkles, text: 'Notificaciones inteligentes' },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:scale-105"
                  style={{
                    background: 'rgba(255, 255, 255, 0.6)',
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <Icon size={18} style={{ color: '#22C55E' }} />
                  <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>
                    {item.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works - Orbit Visual */}
      <section className="py-24 relative overflow-hidden" style={{ background: '#1A1A1A' }}>
        <div className="absolute inset-0 pointer-events-none">
          {/* Orbital rings decoration */}
          <div
            className="absolute w-[600px] h-[600px] rounded-full border opacity-10"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              borderColor: '#22C55E',
              borderWidth: '1px',
            }}
          />
          <div
            className="absolute w-[400px] h-[400px] rounded-full border opacity-10"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(30deg)',
              borderColor: '#FFFFFF',
              borderWidth: '1px',
              borderRadius: '50%',
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2
              className="text-3xl md:text-5xl font-semibold mb-4 text-white"
              style={{ letterSpacing: '-0.02em' }}
            >
              Todo gira alrededor
              <br />
              <span style={{ color: '#22C55E' }}>de tu exito</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
              En Orbit, cada modulo esta conectado. Cuando creas un proyecto, las tareas se sincronizan.
              Cuando completas trabajo, las facturas se generan. Todo en armonia.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Configura tu agencia',
                description: 'Agrega tu equipo, define roles y permisos. Importa tus clientes existentes en minutos.',
              },
              {
                step: '02',
                title: 'Gestiona proyectos',
                description: 'Crea proyectos desde plantillas, asigna tareas, y monitorea el progreso en tiempo real.',
              },
              {
                step: '03',
                title: 'Automatiza y escala',
                description: 'Configura facturacion automatica, reportes y automatizaciones. Enfocate en crecer.',
              },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
                  style={{
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                  }}
                >
                  <span className="text-2xl font-semibold" style={{ color: '#22C55E' }}>
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)' }}>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section id="integrations" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2
                className="text-3xl md:text-5xl font-semibold mb-6"
                style={{ color: '#1A1A1A', letterSpacing: '-0.02em' }}
              >
                Conecta tus
                <br />
                <span style={{ color: '#22C55E' }}>herramientas favoritas</span>
              </h2>
              <p className="text-lg mb-8" style={{ color: '#6B6B6B' }}>
                Sincroniza automaticamente metricas de Shopify, Facebook Ads y mas.
                Ve el rendimiento real de tus clientes sin salir de Orbit.
              </p>
              <div className="space-y-4">
                {[
                  'Metricas de Shopify en tiempo real',
                  'ROAS de Facebook Ads automatico',
                  'Sincronizacion diaria automatica',
                  'Dashboard unificado de rendimiento',
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(34, 197, 94, 0.15)' }}
                    >
                      <Check size={14} style={{ color: '#22C55E' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'Shopify', emoji: '🛒', desc: 'E-commerce' },
                { name: 'Facebook Ads', emoji: '📘', desc: 'Publicidad' },
                { name: 'Google Analytics', emoji: '📊', desc: 'Analytics' },
                { name: 'Slack', emoji: '💬', desc: 'Comunicacion' },
              ].map((integration, index) => (
                <div
                  key={index}
                  className="p-6 rounded-3xl text-center transition-all duration-300 hover:scale-105"
                  style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.8)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <div className="text-4xl mb-3">{integration.emoji}</div>
                  <div className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>
                    {integration.name}
                  </div>
                  <div className="text-xs" style={{ color: '#6B6B6B' }}>
                    {integration.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 relative" style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 40% at 80% 50%, rgba(251, 191, 36, 0.06) 0%, transparent 50%)`,
          }}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2
              className="text-3xl md:text-5xl font-semibold mb-4"
              style={{ color: '#1A1A1A', letterSpacing: '-0.02em' }}
            >
              Agencias en orbita
              <br />
              <span style={{ color: '#22C55E' }}>que ya despegaron</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="p-8 rounded-3xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="#F59E0B" color="#F59E0B" />
                  ))}
                </div>
                <p className="text-base mb-6 leading-relaxed" style={{ color: '#404040' }}>
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ background: '#1A1A1A' }}
                  >
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>
                      {testimonial.author}
                    </div>
                    <div className="text-xs" style={{ color: '#6B6B6B' }}>
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2
              className="text-3xl md:text-5xl font-semibold mb-4"
              style={{ color: '#1A1A1A', letterSpacing: '-0.02em' }}
            >
              Planes simples,
              <br />
              <span style={{ color: '#22C55E' }}>precios transparentes</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: '#6B6B6B' }}>
              Elige el plan que mejor se adapte a tu agencia. Todos incluyen soporte y actualizaciones.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className="p-8 rounded-3xl relative transition-all duration-300"
                style={{
                  background: plan.popular ? '#1A1A1A' : 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(12px)',
                  border: plan.popular ? 'none' : '1px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: plan.popular
                    ? '0 8px 32px rgba(26, 26, 26, 0.2)'
                    : '0 4px 16px rgba(0, 0, 0, 0.04)',
                  transform: plan.popular ? 'scale(1.05)' : 'none',
                }}
              >
                {plan.popular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold"
                    style={{ background: '#22C55E', color: 'white' }}
                  >
                    Mas popular
                  </div>
                )}
                <div className="mb-6">
                  <h3
                    className="text-xl font-semibold mb-2"
                    style={{ color: plan.popular ? 'white' : '#1A1A1A' }}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: plan.popular ? 'rgba(255,255,255,0.7)' : '#6B6B6B' }}
                  >
                    {plan.description}
                  </p>
                </div>
                <div className="mb-6">
                  <span
                    className="text-4xl font-semibold"
                    style={{ color: plan.popular ? 'white' : '#1A1A1A', letterSpacing: '-0.02em' }}
                  >
                    ${plan.price}
                  </span>
                  <span style={{ color: plan.popular ? 'rgba(255,255,255,0.7)' : '#6B6B6B' }}>
                    {plan.period}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check
                        size={16}
                        style={{ color: '#22C55E' }}
                      />
                      <span
                        className="text-sm"
                        style={{ color: plan.popular ? 'rgba(255,255,255,0.9)' : '#404040' }}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  className="w-full py-3 rounded-xl font-medium text-sm transition-all duration-150 hover:scale-105"
                  style={{
                    background: plan.popular ? '#22C55E' : '#1A1A1A',
                    color: 'white',
                    boxShadow: plan.popular
                      ? '0 4px 12px rgba(34, 197, 94, 0.3)'
                      : '0 2px 8px rgba(26, 26, 26, 0.15)',
                  }}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 50% 50%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)
            `,
          }}
        />
        {/* Orbital decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute w-[300px] h-[300px] rounded-full border opacity-[0.08]"
            style={{
              top: '50%',
              left: '20%',
              transform: 'translateY(-50%)',
              borderColor: '#22C55E',
              borderWidth: '2px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex mb-8">
            <OrbitLogoIcon size={64} variant="dark" />
          </div>
          <h2
            className="text-3xl md:text-5xl font-semibold mb-6"
            style={{ color: '#1A1A1A', letterSpacing: '-0.02em' }}
          >
            Pon tu agencia
            <br />
            <span style={{ color: '#22C55E' }}>en orbita</span>
          </h2>
          <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: '#6B6B6B' }}>
            Unete a cientos de agencias que ya usan Orbit para crecer de manera organizada y rentable.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-medium px-8 py-4 rounded-xl text-white transition-all duration-150 hover:scale-105"
              style={{ background: '#1A1A1A', boxShadow: '0 4px 12px rgba(26, 26, 26, 0.2)' }}
            >
              Comenzar gratis
              <ArrowRight size={18} />
            </Link>
            <button
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-medium px-8 py-4 rounded-xl transition-all duration-150 hover:bg-white"
              style={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                color: '#1A1A1A',
              }}
            >
              Agendar demo
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#1A1A1A' }} className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <OrbitLogoIcon size={40} variant="light" />
                <span className="text-xl font-semibold tracking-tight text-white">Orbit</span>
              </div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                La plataforma todo-en-uno para agencias digitales y de marketing.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Producto</h4>
              <ul className="space-y-2">
                {['Funciones', 'Integraciones', 'Precios', 'Changelog'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Recursos</h4>
              <ul className="space-y-2">
                {['Documentacion', 'Blog', 'Guias', 'Soporte'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                {['Privacidad', 'Terminos', 'Cookies'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              © 2025 Orbit. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Hecho con</span>
              <span style={{ color: '#22C55E' }}>♥</span>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>en LATAM</span>
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
