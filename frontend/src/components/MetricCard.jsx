import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * MetricCard - Reusable card component for displaying metrics
 * Clean design with lime/dark accents
 */
function MetricCard({
  title,
  value,
  icon: Icon,
  iconBgColor = 'bg-[#BFFF00]/20',
  iconColor = 'text-[#65A30D]',
  change = null,
  changeLabel = '',
  format = 'number',
  prefix = '',
  suffix = '',
  loading = false,
  valueColor = 'text-[#1A1A2E]'
}) {
  // Format value based on type
  const formatValue = (val) => {
    if (val === null || val === undefined) return '-';

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(val);
      case 'percent':
        return `${Number(val).toFixed(2)}%`;
      case 'decimal':
        return Number(val).toFixed(2);
      case 'integer':
        return new Intl.NumberFormat('es-CO').format(Math.round(val));
      default:
        return new Intl.NumberFormat('es-CO', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }).format(val);
    }
  };

  // Determine if change is positive or negative
  const isPositive = change !== null && change >= 0;
  const changeColor = isPositive ? 'text-[#10B981]' : 'text-[#F97316]';
  const changeBgColor = isPositive ? 'bg-[#10B981]/10' : 'bg-[#F97316]/10';
  const ChangeTrendIcon = isPositive ? TrendingUp : TrendingDown;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-gray-200 rounded-lg w-24"></div>
          <div className="w-11 h-11 bg-gray-200 rounded-xl"></div>
        </div>
        <div className="h-9 bg-gray-200 rounded-lg w-32 mb-3"></div>
        <div className="h-4 bg-gray-200 rounded-lg w-20"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 group hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{title}</span>
        {Icon && (
          <div className={`w-11 h-11 ${iconBgColor} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>

      <div className="mb-3">
        <span className={`text-4xl font-black tracking-tight tabular-nums ${valueColor}`}>
          {prefix}{formatValue(value)}{suffix}
        </span>
      </div>

      {change !== null && (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${changeBgColor}`}>
          <ChangeTrendIcon className={`w-3.5 h-3.5 ${changeColor}`} />
          <span className={`text-xs font-medium ${changeColor}`}>
            {isPositive ? '+' : ''}{Number(change).toFixed(1)}%
          </span>
          {changeLabel && (
            <span className="text-xs text-gray-400">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default MetricCard;
