import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ugcPublicAPI } from '../utils/api';
import { CheckCircle, AlertCircle, Loader2, Instagram, Video, Globe, MapPin, Phone, User, Mail, CreditCard, DollarSign, Camera, Languages, Clock, Briefcase, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { departments, getCitiesByDepartment } from '../data/colombiaLocations';

const STEPS = [
  { id: 1, title: 'Datos Básicos', icon: User },
  { id: 2, title: 'Redes Sociales', icon: Instagram },
  { id: 3, title: 'Tu Perfil', icon: Briefcase },
  { id: 4, title: 'Tu Trabajo', icon: Camera },
  { id: 5, title: 'Disponibilidad', icon: Clock },
];

const UGCRegister = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [orgInfo, setOrgInfo] = useState(null);
  const [industries, setIndustries] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    cedula: '',
    social_networks: {
      instagram: '',
      tiktok: '',
      other: ''
    },
    address: '',
    department: '',
    city: '',
    postal_code: '',
    shipping_notes: '',
    industries: [],
    other_industry: '',
    bio: '',
    portfolio: {
      video1: '',
      video2: ''
    },
    rate_per_video: '',
    traits: {
      gender: '',
      hair_color: '',
      eye_color: '',
      body_type: '',
      is_parent: false,
      has_pets: false,
      is_fitness: false,
      hobbies: ''
    },
    languages: [],
    equipment: [],
    availability: {
      videos_per_week: '',
      delivery_time: ''
    }
  });

  const availableCities = formData.department ? getCitiesByDepartment(formData.department) : [];

  const handleDepartmentChange = (dept) => {
    setFormData({ ...formData, department: dept, city: '' });
  };

  useEffect(() => {
    loadRegistrationInfo();
  }, [token]);

  const loadRegistrationInfo = async () => {
    try {
      const response = await ugcPublicAPI.getRegistrationInfo(token);
      setOrgInfo(response.data.organization);
      setIndustries(response.data.industries);
    } catch (err) {
      setError(err.response?.data?.error || 'Link de registro inválido o expirado');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await ugcPublicAPI.register(token, formData);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIndustryToggle = (slug) => {
    setFormData(prev => ({
      ...prev,
      industries: prev.industries.includes(slug)
        ? prev.industries.filter(i => i !== slug)
        : [...prev.industries, slug]
    }));
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return formData.full_name.trim() && formData.phone.trim();
      case 2:
        return true; // Social networks are optional
      case 3:
        return true; // Profile is optional
      case 4:
        return true; // Work details are optional
      case 5:
        return formData.department && formData.city;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !orgInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Inválido</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Registro Exitoso!</h1>
          <p className="text-gray-600 mb-6">
            Gracias por registrarte. Pronto nos pondremos en contacto contigo para los siguientes pasos.
          </p>
          <p className="text-sm text-gray-500">Ya puedes cerrar esta página.</p>
        </div>
      </div>
    );
  }

  // Step content components
  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre Completo *
        </label>
        <input
          type="text"
          required
          className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black transition-all"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          placeholder="Tu nombre completo"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          WhatsApp *
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="tel"
            required
            className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-black focus:border-black transition-all"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+57 300 123 4567"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-black focus:border-black transition-all"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="tu@email.com"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cédula
        </label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-black focus:border-black transition-all"
            value={formData.cedula}
            onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
            placeholder="1234567890"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Instagram
        </label>
        <div className="relative">
          <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-black focus:border-black transition-all"
            value={formData.social_networks.instagram}
            onChange={(e) => setFormData({
              ...formData,
              social_networks: { ...formData.social_networks, instagram: e.target.value }
            })}
            placeholder="@tu_usuario"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          TikTok
        </label>
        <div className="relative">
          <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-black focus:border-black transition-all"
            value={formData.social_networks.tiktok}
            onChange={(e) => setFormData({
              ...formData,
              social_networks: { ...formData.social_networks, tiktok: e.target.value }
            })}
            placeholder="@tu_usuario"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Otras redes / Portafolio
        </label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-black focus:border-black transition-all"
            value={formData.social_networks.other}
            onChange={(e) => setFormData({
              ...formData,
              social_networks: { ...formData.social_networks, other: e.target.value }
            })}
            placeholder="YouTube, LinkedIn, sitio web, etc."
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      {/* Industrias */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Industrias de Interés</h3>
        <p className="text-xs text-gray-500 mb-3">Selecciona las categorías en las que te gustaría crear contenido</p>
        <div className="flex flex-wrap gap-2">
          {industries.map((industry) => (
            <button
              key={industry.id}
              type="button"
              onClick={() => handleIndustryToggle(industry.slug)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                formData.industries.includes(industry.slug)
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {industry.icon} {industry.name}
            </button>
          ))}
        </div>
        {formData.industries.includes('otros') && (
          <div className="mt-3">
            <input
              type="text"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black"
              value={formData.other_industry}
              onChange={(e) => setFormData({ ...formData, other_industry: e.target.value })}
              placeholder="Especifica qué otras industrias..."
            />
          </div>
        )}
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cuéntanos sobre ti
        </label>
        <textarea
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black transition-all"
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          placeholder="¿Qué tipo de contenido creas? ¿Cuál es tu estilo?"
        />
      </div>

      {/* Rasgos */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Rasgos y Características</h3>
        <p className="text-xs text-gray-500 mb-3">Ayuda a las marcas a encontrarte más fácilmente</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Género</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-black focus:border-black bg-white text-sm"
              value={formData.traits.gender}
              onChange={(e) => setFormData({
                ...formData,
                traits: { ...formData.traits, gender: e.target.value }
              })}
            >
              <option value="">Seleccionar</option>
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
              <option value="non-binary">No binario</option>
              <option value="prefer-not-say">Prefiero no decir</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cabello</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-black focus:border-black bg-white text-sm"
              value={formData.traits.hair_color}
              onChange={(e) => setFormData({
                ...formData,
                traits: { ...formData.traits, hair_color: e.target.value }
              })}
            >
              <option value="">Seleccionar</option>
              <option value="black">Negro</option>
              <option value="brown">Castaño</option>
              <option value="blonde">Rubio</option>
              <option value="red">Pelirrojo</option>
              <option value="gray">Canoso</option>
              <option value="colored">Teñido/Fantasía</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ojos</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-black focus:border-black bg-white text-sm"
              value={formData.traits.eye_color}
              onChange={(e) => setFormData({
                ...formData,
                traits: { ...formData.traits, eye_color: e.target.value }
              })}
            >
              <option value="">Seleccionar</option>
              <option value="brown">Café</option>
              <option value="black">Negro</option>
              <option value="green">Verde</option>
              <option value="blue">Azul</option>
              <option value="hazel">Miel</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contextura</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-black focus:border-black bg-white text-sm"
              value={formData.traits.body_type}
              onChange={(e) => setFormData({
                ...formData,
                traits: { ...formData.traits, body_type: e.target.value }
              })}
            >
              <option value="">Seleccionar</option>
              <option value="slim">Delgada</option>
              <option value="athletic">Atlética</option>
              <option value="average">Promedio</option>
              <option value="curvy">Curvy</option>
              <option value="plus-size">Plus size</option>
            </select>
          </div>
        </div>

        {/* Lifestyle checkboxes */}
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { key: 'is_parent', label: '👶 Mamá/Papá' },
            { key: 'has_pets', label: '🐾 Mascotero/a' },
            { key: 'is_fitness', label: '💪 Fitness' }
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData({
                ...formData,
                traits: { ...formData.traits, [key]: !formData.traits[key] }
              })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                formData.traits[key]
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black text-sm"
          value={formData.traits.hobbies}
          onChange={(e) => setFormData({
            ...formData,
            traits: { ...formData.traits, hobbies: e.target.value }
          })}
          placeholder="Hobbies: cocina, viajes, lectura, gaming..."
        />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      {/* Portfolio */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Portafolio</h3>
        <p className="text-xs text-gray-500 mb-3">Comparte enlaces a tus mejores videos UGC</p>
        <div className="space-y-3">
          <div className="relative">
            <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="url"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-black focus:border-black text-sm"
              value={formData.portfolio.video1}
              onChange={(e) => setFormData({
                ...formData,
                portfolio: { ...formData.portfolio, video1: e.target.value }
              })}
              placeholder="Video 1: https://drive.google.com/..."
            />
          </div>
          <div className="relative">
            <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="url"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-black focus:border-black text-sm"
              value={formData.portfolio.video2}
              onChange={(e) => setFormData({
                ...formData,
                portfolio: { ...formData.portfolio, video2: e.target.value }
              })}
              placeholder="Video 2: https://drive.google.com/..."
            />
          </div>
        </div>
      </div>

      {/* Tarifa */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Tarifa por video (COP)</h3>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            type="number"
            className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-3 focus:ring-2 focus:ring-black focus:border-black"
            value={formData.rate_per_video}
            onChange={(e) => setFormData({ ...formData, rate_per_video: e.target.value })}
            placeholder="150000"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">¿Cuánto cobras aproximadamente por un video UGC?</p>
      </div>

      {/* Idiomas */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Idiomas</h3>
        <p className="text-xs text-gray-500 mb-3">¿En qué idiomas puedes crear contenido?</p>
        <div className="flex flex-wrap gap-2">
          {['Español', 'Inglés', 'Portugués', 'Francés', 'Otro'].map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => {
                const languages = formData.languages.includes(lang)
                  ? formData.languages.filter(l => l !== lang)
                  : [...formData.languages, lang];
                setFormData({ ...formData, languages });
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                formData.languages.includes(lang)
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Equipo */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Equipo</h3>
        <p className="text-xs text-gray-500 mb-3">¿Con qué equipo cuentas para grabar?</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'iphone', label: '📱 iPhone' },
            { id: 'android', label: '📱 Android' },
            { id: 'camera', label: '📷 Cámara' },
            { id: 'microphone', label: '🎙️ Mic' },
            { id: 'lights', label: '💡 Luces' },
            { id: 'drone', label: '🚁 Drone' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                const equipment = formData.equipment.includes(item.id)
                  ? formData.equipment.filter(e => e !== item.id)
                  : [...formData.equipment, item.id];
                setFormData({ ...formData, equipment });
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                formData.equipment.includes(item.id)
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      {/* Disponibilidad */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Disponibilidad</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Videos por semana</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-black focus:border-black bg-white text-sm"
              value={formData.availability.videos_per_week}
              onChange={(e) => setFormData({
                ...formData,
                availability: { ...formData.availability, videos_per_week: e.target.value }
              })}
            >
              <option value="">Seleccionar</option>
              <option value="1-2">1-2 videos</option>
              <option value="3-5">3-5 videos</option>
              <option value="6-10">6-10 videos</option>
              <option value="10+">Más de 10</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tiempo de entrega</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-black focus:border-black bg-white text-sm"
              value={formData.availability.delivery_time}
              onChange={(e) => setFormData({
                ...formData,
                availability: { ...formData.availability, delivery_time: e.target.value }
              })}
            >
              <option value="">Seleccionar</option>
              <option value="24h">24 horas</option>
              <option value="2-3days">2-3 días</option>
              <option value="4-7days">4-7 días</option>
              <option value="1week+">Más de una semana</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dirección de envío */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Dirección de Envío
        </h3>
        <p className="text-xs text-gray-500 mb-3">Para enviarte productos de las marcas</p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Departamento *</label>
              <select
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-black focus:border-black bg-white text-sm"
                value={formData.department}
                onChange={(e) => handleDepartmentChange(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ciudad *</label>
              <select
                required
                disabled={!formData.department}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-black focus:border-black bg-white text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              >
                <option value="">{formData.department ? 'Seleccionar' : 'Primero depto'}</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dirección</label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black text-sm"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Calle, número, apartamento, etc."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Código Postal</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black text-sm"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                placeholder="110111"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Instrucciones</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-black text-sm"
                value={formData.shipping_notes}
                onChange={(e) => setFormData({ ...formData, shipping_notes: e.target.value })}
                placeholder="Torre, apto, portería..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          {orgInfo?.logo_url && (
            <img src={orgInfo.logo_url} alt={orgInfo.name} className="h-12 mx-auto mb-3" />
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Únete como Creador UGC</h1>
          <p className="text-sm text-gray-600">
            Crea contenido increíble para las mejores marcas
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-black text-white'
                        : isCurrent
                        ? 'bg-black text-white ring-4 ring-gray-200'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-8 md:w-12 h-1 mx-1 rounded transition-all ${
                        currentStep > step.id ? 'bg-black' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-center text-sm font-medium text-gray-700">
            {STEPS[currentStep - 1].title}
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Step Content */}
          <div className="min-h-[300px]">
            {renderCurrentStep()}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                currentStep === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>

            {currentStep < STEPS.length ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!validateStep(currentStep)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  validateStep(currentStep)
                    ? 'bg-black text-white hover:bg-gray-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || !validateStep(currentStep)}
                className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    Registrarme
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </form>

        {/* Privacy note */}
        <p className="text-xs text-gray-500 text-center mt-4 px-4">
          Tu información será tratada con confidencialidad y solo se usará para contactarte sobre oportunidades de contenido.
        </p>
      </div>
    </div>
  );
};

export default UGCRegister;
