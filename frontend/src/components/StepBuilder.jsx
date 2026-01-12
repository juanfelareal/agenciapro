import { useState } from 'react';
import NoteEditor from './NoteEditor';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Video,
  Play
} from 'lucide-react';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Parse video URL to get embed URL
const getVideoEmbed = (url) => {
  if (!url) return null;

  try {
    // YouTube: youtube.com/watch?v=ID or youtu.be/ID
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId;
      if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(new URL(url).search);
        videoId = urlParams.get('v');
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
      } else if (url.includes('youtube.com/embed/')) {
        videoId = url.split('embed/')[1]?.split('?')[0];
      }
      if (videoId) return { url: `https://www.youtube.com/embed/${videoId}`, provider: 'YouTube' };
    }

    // Vimeo: vimeo.com/ID
    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0]?.split('/')[0];
      if (videoId) return { url: `https://player.vimeo.com/video/${videoId}`, provider: 'Vimeo' };
    }

    // Loom: loom.com/share/ID
    if (url.includes('loom.com')) {
      const videoId = url.split('/').pop()?.split('?')[0];
      if (videoId) return { url: `https://www.loom.com/embed/${videoId}`, provider: 'Loom' };
    }

    // Google Drive: drive.google.com/file/d/ID/view
    if (url.includes('drive.google.com')) {
      const match = url.match(/\/d\/(.+?)\//);
      if (match?.[1]) return { url: `https://drive.google.com/file/d/${match[1]}/preview`, provider: 'Google Drive' };
    }

    // Generic: assume direct embed URL
    return { url, provider: 'Video' };
  } catch {
    return null;
  }
};

const VideoPreview = ({ url }) => {
  const embed = getVideoEmbed(url);

  if (!embed) {
    return (
      <div className="flex items-center justify-center h-32 bg-slate-100 rounded-lg text-slate-400">
        <div className="text-center">
          <Video size={24} className="mx-auto mb-1" />
          <span className="text-sm">URL no válida</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
        {embed.provider}
      </div>
      <iframe
        src={embed.url}
        className="w-full h-48 rounded-lg"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

const StepCard = ({ step, index, totalSteps, onChange, onDelete, onMoveUp, onMoveDown }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showVideoInput, setShowVideoInput] = useState(!!step.video_url);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Step Header */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-1 text-slate-400">
          <GripVertical size={16} className="cursor-grab" />
        </div>

        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-500 text-white font-semibold text-sm">
          {index + 1}
        </div>

        <input
          type="text"
          value={step.title}
          onChange={(e) => onChange({ ...step, title: e.target.value })}
          placeholder={`Título del paso ${index + 1}`}
          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-300"
        />

        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Mover arriba"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalSteps - 1}
            className="p-1.5 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Mover abajo"
          >
            <ChevronDown size={16} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-slate-200 rounded"
            title={isExpanded ? 'Contraer' : 'Expandir'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-100 rounded text-red-500"
            title="Eliminar paso"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Step Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Description Editor */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Descripción del paso
            </label>
            <NoteEditor
              content={step.content}
              onChange={({ json }) => onChange({ ...step, content: json })}
              placeholder="Describe los detalles de este paso..."
              minHeight="120px"
            />
          </div>

          {/* Video Section */}
          <div>
            {!showVideoInput ? (
              <button
                onClick={() => setShowVideoInput(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Video size={16} />
                Agregar video
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Video size={16} className="text-slate-500 flex-shrink-0" />
                  <input
                    type="url"
                    value={step.video_url || ''}
                    onChange={(e) => onChange({ ...step, video_url: e.target.value })}
                    placeholder="URL del video (YouTube, Vimeo, Loom, Google Drive)"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                  <button
                    onClick={() => {
                      onChange({ ...step, video_url: null });
                      setShowVideoInput(false);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                    title="Quitar video"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {step.video_url && (
                  <VideoPreview url={step.video_url} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StepBuilder = ({ steps = [], onChange }) => {
  const handleAddStep = () => {
    const newStep = {
      id: generateId(),
      order: steps.length + 1,
      title: '',
      content: null,
      video_url: null
    };
    onChange([...steps, newStep]);
  };

  const handleUpdateStep = (index, updatedStep) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    onChange(newSteps);
  };

  const handleDeleteStep = (index) => {
    if (!confirm('¿Eliminar este paso?')) return;
    const newSteps = steps.filter((_, i) => i !== index);
    // Recalculate order
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });
    onChange(newSteps);
  };

  const handleMoveStep = (index, direction) => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newSteps.length) return;

    // Swap steps
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];

    // Recalculate order
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });

    onChange(newSteps);
  };

  return (
    <div className="space-y-4">
      {steps.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <Play size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 mb-4">No hay pasos aún</p>
          <button
            onClick={handleAddStep}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Plus size={18} />
            Agregar primer paso
          </button>
        </div>
      ) : (
        <>
          {steps.map((step, index) => (
            <StepCard
              key={step.id}
              step={step}
              index={index}
              totalSteps={steps.length}
              onChange={(updated) => handleUpdateStep(index, updated)}
              onDelete={() => handleDeleteStep(index)}
              onMoveUp={() => handleMoveStep(index, 'up')}
              onMoveDown={() => handleMoveStep(index, 'down')}
            />
          ))}

          <button
            onClick={handleAddStep}
            className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <Plus size={18} />
            Agregar paso
          </button>
        </>
      )}
    </div>
  );
};

// Export the video embed function for use in view mode
export { getVideoEmbed, VideoPreview };
export default StepBuilder;
