/**
 * KPI Card component for financial dashboard
 * Uses platform's glass design system (light theme)
 */
import { TrendingUp, TrendingDown } from 'lucide-react';

const KPICard = ({ title, value, change, subtitle, icon: Icon, iconColor = 'teal' }) => {
  const iconColorMap = {
    teal: 'bg-teal-100 text-teal-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    rose: 'bg-rose-100 text-rose-600',
    amber: 'bg-amber-100 text-amber-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    violet: 'bg-violet-100 text-violet-600',
    blue: 'bg-blue-100 text-blue-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div className="glass rounded-2xl p-5 hover:bg-white/80 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        {Icon && (
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColorMap[iconColor]}`}>
            <Icon className="w-5 h-5" />
          </span>
        )}
        {change !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-full ${
            isPositive ? 'bg-emerald-100 text-emerald-600' :
            isNegative ? 'bg-rose-100 text-rose-600' :
            'bg-gray-100 text-gray-500'
          }`}>
            {isPositive && <TrendingUp className="w-3 h-3" />}
            {isNegative && <TrendingDown className="w-3 h-3" />}
            {isPositive && '+'}{change !== undefined ? `${change.toFixed(1)}%` : ''}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-500 font-medium mb-1">{title}</div>
      <div className="text-2xl font-bold text-[#17181A] tracking-tight">{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
};

export default KPICard;
