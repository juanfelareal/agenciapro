import { Link } from 'react-router-dom';

const MessageBubble = ({ message, isOwn, showSender }) => {
  // Parse entity mentions in content
  const renderContent = (content, entityMentions) => {
    if (!entityMentions || entityMentions.length === 0) {
      return content;
    }

    let mentions;
    try {
      mentions = typeof entityMentions === 'string' ? JSON.parse(entityMentions) : entityMentions;
    } catch {
      return content;
    }

    if (!Array.isArray(mentions) || mentions.length === 0) return content;

    // Replace mention labels with links
    const parts = [];
    let remaining = content;

    for (const mention of mentions) {
      const idx = remaining.indexOf(mention.label);
      if (idx === -1) continue;

      if (idx > 0) parts.push(remaining.substring(0, idx));

      const path = mention.type === 'task' ? '/app/tasks' : '/app/projects';
      parts.push(
        <Link
          key={`${mention.type}-${mention.id}`}
          to={path}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
        >
          {mention.label}
        </Link>
      );

      remaining = remaining.substring(idx + mention.label.length);
    }

    if (remaining) parts.push(remaining);
    return parts.length > 0 ? parts : content;
  };

  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const time = new Date(message.created_at).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={`max-w-[70%] ${isOwn ? 'order-1' : ''}`}>
        {showSender && !isOwn && (
          <p className="text-xs font-medium text-gray-500 mb-0.5 ml-3">{message.sender_name}</p>
        )}
        <div
          className={`px-3 py-2 rounded-2xl ${
            isOwn
              ? 'bg-[#1A1A2E] text-white rounded-br-md'
              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {renderContent(message.content, message.entity_mentions)}
          </p>
          <p className={`text-[10px] mt-1 text-right ${isOwn ? 'text-gray-400' : 'text-gray-400'}`}>
            {time}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
