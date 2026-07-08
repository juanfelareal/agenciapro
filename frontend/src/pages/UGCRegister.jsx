import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ugcPublicAPI } from '../utils/api';
import { CheckCircle, AlertCircle, Loader2, Instagram, Video, Globe, MapPin, Phone, User, Mail, CreditCard } from 'lucide-react';
import { departments, getCitiesByDepartment } from '../data/colombiaLocations';

const UGCRegister = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [orgInfo, setOrgInfo] = useState(null);
  const [industries, setIndustries] = useState([]);

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
    bio: ''
  });

  // Get cities based on selected department
  const availableCities = formData.department ? getCitiesByDepartment(formData.department) : [];

  // Handle department change - reset city when department changes
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {orgInfo?.logo_url && (
            <img src={orgInfo.logo_url} alt={orgInfo.name} className="h-16 mx-auto mb-4" />
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Únete como Creador UGC</h1>
          <p className="text-gray-600">
            Regístrate para crear contenido increíble para las mejores marcas
          </p>
        </div>

        {/* How it works */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 mb-6 text-white">
          <h2 className="text-lg font-semibold mb-3">¿Cómo funciona?</h2>
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              <p><span className="text-white font-medium">Te registras</span> — Completas este formulario para que conozcamos tu perfil y estilo de contenido.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              <p><span className="text-white font-medium">Te proponemos proyectos</span> — Cuando una marca busque un perfil como el tuyo, te contactamos con los detalles del proyecto y la compensación.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              <p><span className="text-white font-medium">Tú decides</span> — Si te interesa, formalizamos un contrato con los términos acordados. Solo entonces enviamos productos.</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-400">
              Registrarte no significa que recibirás productos automáticamente. Cada colaboración es una negociación individual donde ambas partes acuerdan los términos.
            </p>
          </div>
        </div>

        {/* Privacy disclaimer */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">Tu privacidad es importante</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              Toda la información que compartas será tratada bajo estrictos parámetros de seguridad. Tus datos personales y dirección <span className="font-medium">únicamente</span> serán utilizados para el envío de productos una vez que hayas aceptado una alianza con alguna marca. No compartiremos tu información bajo ninguna otra condición.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Datos personales */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Datos Personales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
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
                    className="w-full border rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
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
                    className="w-full border rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
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
                    className="w-full border rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
                    value={formData.cedula}
                    onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                    placeholder="1234567890"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Redes sociales */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Video className="w-5 h-5" />
              Redes Sociales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instagram
                </label>
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    className="w-full border rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
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
                    className="w-full border rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
                    value={formData.social_networks.tiktok}
                    onChange={(e) => setFormData({
                      ...formData,
                      social_networks: { ...formData.social_networks, tiktok: e.target.value }
                    })}
                    placeholder="@tu_usuario"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Otras redes / Portafolio
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    className="w-full border rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
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
          </div>

          {/* Industrias de interés */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Industrias de Interés</h2>
            <p className="text-sm text-gray-500 mb-4">Selecciona las categorías en las que te gustaría crear contenido</p>
            <div className="flex flex-wrap gap-2">
              {industries.map((industry) => (
                <button
                  key={industry.id}
                  type="button"
                  onClick={() => handleIndustryToggle(industry.slug)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    formData.industries.includes(industry.slug)
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {industry.icon} {industry.name}
                </button>
              ))}
            </div>
            {/* Campo "Otros ¿cuál?" - aparece cuando se selecciona Otros */}
            {formData.industries.includes('otros') && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Otros ¿cuál? *
                </label>
                <input
                  type="text"
                  required={formData.industries.includes('otros')}
                  className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
                  value={formData.other_industry}
                  onChange={(e) => setFormData({ ...formData, other_industry: e.target.value })}
                  placeholder="Especifica qué otras industrias te interesan..."
                />
              </div>
            )}
          </div>

          {/* Dirección de envío */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Dirección de Envío
            </h2>
            <p className="text-sm text-gray-500 mb-4">Para enviarte productos de las marcas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departamento *
                </label>
                <select
                  required
                  className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black bg-white"
                  value={formData.department}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                >
                  <option value="">Selecciona un departamento</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad *
                </label>
                <select
                  required
                  disabled={!formData.department}
                  className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                >
                  <option value="">{formData.department ? 'Selecciona una ciudad' : 'Primero selecciona departamento'}</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Calle, número, apartamento, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código Postal
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="110111"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instrucciones de envío
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
                  value={formData.shipping_notes}
                  onChange={(e) => setFormData({ ...formData, shipping_notes: e.target.value })}
                  placeholder="Torre 2, apto 301, portería 24h..."
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cuéntanos sobre ti
            </label>
            <textarea
              rows={3}
              className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-black focus:border-black"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="¿Qué tipo de contenido creas? ¿Cuál es tu estilo? ¿Tienes experiencia previa con marcas?"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black text-white py-3 rounded-xl font-semibold text-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Registrando...
              </>
            ) : (
              'Registrarme como Creador'
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Al registrarte, aceptas ser contactado por {orgInfo?.name} para oportunidades de creación de contenido.
          </p>
        </form>
      </div>
    </div>
  );
};

export default UGCRegister;
