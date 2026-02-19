import { useState, useEffect } from 'react';
import { X, Video, Link, Check, AlertCircle } from 'lucide-react';
import { parseVideoUrl, getPlatformName, getPlatformIcon } from '../utils/videoEmbedParser';

const VideoEmbedModal = ({ isOpen, onClose, onInsert }) => {
  const [url, setUrl] = useState('');
  const [parsedVideo, setParsedVideo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (url.trim()) {
      const result = parseVideoUrl(url);
      if (result) {
        setParsedVideo(result);
        setError('');
      } else {
        setParsedVideo(null);
        if (url.length > 10) {
          setError('URL no reconocida. Soportamos: YouTube, Vimeo, TikTok, Instagram, Twitter/X');
        }
      }
    } else {
      setParsedVideo(null);
      setError('');
    }
  }, [url]);

  const handleInsert = () => {
    if (parsedVideo) {
      onInsert({
        src: url,
        platform: parsedVideo.platform,
        videoId: parsedVideo.videoId,
      });
      setUrl('');
      setParsedVideo(null);
      onClose();
    }
  };

  const handleClose = () => {
    setUrl('');
    setParsedVideo(null);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Video size={20} className="text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Insertar Video</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              URL del video
            </label>
            <div className="relative">
              <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Supported platforms */}
          <div className="flex flex-wrap gap-2">
            {['youtube', 'vimeo', 'tiktok', 'instagram', 'twitter'].map((platform) => (
              <span
                key={platform}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${
                  parsedVideo?.platform === platform
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {getPlatformIcon(platform)} {getPlatformName(platform)}
              </span>
            ))}
          </div>

          {/* Preview / Status */}
          {parsedVideo && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Check size={20} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {getPlatformIcon(parsedVideo.platform)} Video de {getPlatformName(parsedVideo.platform)} detectado
                </p>
                <p className="text-xs text-green-600">ID: {parsedVideo.videoId}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleInsert}
            disabled={!parsedVideo}
            className="px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2a2a3e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Insertar Video
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoEmbedModal;
