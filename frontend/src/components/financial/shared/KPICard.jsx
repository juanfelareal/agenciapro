/**
 * KPI Card component for financial dashboard
 * Premium dark theme with colored icons
 */
const KPICard = ({ icon, label, value, change, changeType = 'neutral', iconColor = 'green' }) => {
  const iconColors = {
    green: 'bg-teal-500/10 text-teal-400',
    red: 'bg-rose-400/10 text-rose-400',
    blue: 'bg-indigo-400/10 text-indigo-400',
    yellow: 'bg-amber-400/10 text-amber-400',
    purple: 'bg-purple-400/10 text-purple-400',
  };

  const changeColors = {
    up: 'text-teal-400',
    down: 'text-rose-400',
    neutral: 'text-[#5c5d66]',
  };

  const changeIcons = {
    up: '↑',
    down: '↓',
    neutral: '',
  };

  return (
    <div className="bg-[#1a1b23] border border-white/5 rounded-2xl p-5 hover:bg-[#22232d] hover:border-white/10 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${iconColors[iconColor]}`}>
          {icon}
        </span>
        <span className="text-[13px] text-[#94959c] font-medium">{label}</span>
      </div>
      <div className="text-[32px] font-bold tracking-tight mb-2">{value}</div>
      <div className={`text-xs font-medium flex items-center gap-1 ${changeColors[changeType]}`}>
        {changeIcons[changeType]} {change}
      </div>
    </div>
  );
};

export default KPICard;
