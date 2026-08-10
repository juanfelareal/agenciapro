import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsAPI } from '../utils/api';
import { ArrowLeft, Loader2 } from 'lucide-react';
import EmailMarketingForm from '../components/EmailMarketingForm';

export default function ClientEmailMarketing() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await clientsAPI.getById(clientId);
        setClient(res.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/clients')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-[#17181A] tracking-tight">Email Marketing</h1>
          <p className="text-sm text-gray-500">{client?.company || client?.name}</p>
        </div>
      </div>

      <EmailMarketingForm clientId={clientId} />
    </div>
  );
}
