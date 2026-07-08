import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { portalDocumentsAPI } from '../../utils/portalApi';
import {
  FileSignature,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Eraser
} from 'lucide-react';

export default function PortalDocumentSign() {
  const { signatureId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    signer_name: '',
    signer_cedula: '',
    accepted_terms: false
  });

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [signatureId]);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [document]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const data = await portalDocumentsAPI.getDocument(signatureId);
      setDocument(data);
      setFormData(prev => ({
        ...prev,
        signer_name: data.signer_name || '',
        signer_cedula: data.signer_cedula || ''
      }));
    } catch (error) {
      console.error('Error loading document:', error);
      setError('No se pudo cargar el documento');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Canvas drawing handlers
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getSignatureData = () => {
    if (!hasSignature) return null;
    return canvasRef.current.toDataURL('image/png');
  };

  const handleSign = async () => {
    if (!formData.signer_name.trim()) {
      setError('Por favor ingresa tu nombre completo');
      return;
    }
    if (!formData.accepted_terms) {
      setError('Debes aceptar los términos para firmar');
      return;
    }

    try {
      setSigning(true);
      setError(null);

      const signatureData = getSignatureData();

      await portalDocumentsAPI.sign(signatureId, {
        signer_name: formData.signer_name,
        signer_cedula: formData.signer_cedula,
        signature_data: signatureData,
        accepted_terms: true
      });

      setSigned(true);
    } catch (error) {
      console.error('Error signing document:', error);
      setError(error.response?.data?.error || 'Error al firmar el documento');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ink-900"></div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-ink-900 mb-2">
          Documento firmado exitosamente
        </h1>
        <p className="text-ink-500 mb-8">
          Gracias por firmar el documento. Puedes ver todos tus documentos firmados en la sección de documentos.
        </p>
        <button
          onClick={() => navigate('/portal/documents')}
          className="bg-ink-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-ink-800 transition-colors"
        >
          Ver mis documentos
        </button>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-ink-900 mb-2">Documento no encontrado</h1>
        <p className="text-ink-500">{error || 'El documento que buscas no existe o ya fue firmado.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/portal/documents')}
          className="flex items-center gap-2 text-ink-500 hover:text-ink-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a documentos
        </button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center">
            <FileSignature className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-900">{document.template_name}</h1>
            {document.template_description && (
              <p className="text-ink-500 mt-1">{document.template_description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="bg-white border border-ink-200 rounded-xl p-6 mb-6">
        <div
          className="prose prose-ink max-w-none"
          dangerouslySetInnerHTML={{ __html: document.rendered_content }}
        />
      </div>

      {/* Signature Form */}
      <div className="bg-white border border-ink-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-ink-900 mb-4">Firma del documento</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">
              Nombre completo *
            </label>
            <input
              type="text"
              name="signer_name"
              value={formData.signer_name}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-ink-200 rounded-lg focus:ring-2 focus:ring-ink-200 focus:border-ink-400 outline-none"
              placeholder="Tu nombre completo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">
              Cédula / ID (opcional)
            </label>
            <input
              type="text"
              name="signer_cedula"
              value={formData.signer_cedula}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-ink-200 rounded-lg focus:ring-2 focus:ring-ink-200 focus:border-ink-400 outline-none"
              placeholder="Número de identificación"
            />
          </div>
        </div>

        {/* Signature Pad */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-ink-700">
              Tu firma (opcional)
            </label>
            {hasSignature && (
              <button
                type="button"
                onClick={clearSignature}
                className="text-sm text-ink-500 hover:text-ink-700 flex items-center gap-1"
              >
                <Eraser className="w-4 h-4" />
                Borrar
              </button>
            )}
          </div>
          <div className="border-2 border-dashed border-ink-200 rounded-xl p-2 bg-ink-50">
            <canvas
              ref={canvasRef}
              width={600}
              height={150}
              className="w-full bg-white rounded-lg cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p className="text-xs text-ink-400 mt-1">
            Dibuja tu firma con el mouse o el dedo si estás en un dispositivo táctil
          </p>
        </div>

        {/* Terms */}
        <div className="mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="accepted_terms"
              checked={formData.accepted_terms}
              onChange={handleInputChange}
              className="mt-1 w-4 h-4 text-ink-900 border-ink-300 rounded focus:ring-ink-500"
            />
            <span className="text-sm text-ink-600">
              He leído y acepto los términos de este documento. Entiendo que al firmar electrónicamente,
              este documento tiene la misma validez legal que una firma física.
            </span>
          </label>
        </div>

        {/* Submit */}
        <button
          onClick={handleSign}
          disabled={signing || !formData.accepted_terms || !formData.signer_name.trim()}
          className="w-full bg-ink-900 text-white py-3 rounded-xl font-medium hover:bg-ink-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {signing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Firmando...
            </>
          ) : (
            <>
              <FileSignature className="w-5 h-5" />
              Firmar documento
            </>
          )}
        </button>
      </div>
    </div>
  );
}
