import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * MetricCard - Reusable card component for displaying metrics
 * Similar to Master Metrics style
 */
function MetricCard({
  title,
  value,
  icon: Icon,
  iconBgColor = 'bg-blue-100',
  iconColor = 'text-blue-600',
  change = null,
  changeLabel = '',
  format = 'number',
  prefix = '',
  suffix = '',
  loading = false
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
  const changeColor = isPositive ? 'text-green-600' : 'text-red-600';
  const ChangeTrendIcon = isPositive ? TrendingUp : TrendingDown;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
        </div>
        <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        {Icon && (
          <div className={`w-10 h-10 ${iconBgColor} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>

      <div className="mb-2">
        <span className="text-2xl font-bold text-gray-900">
          {prefix}{formatValue(value)}{suffix}
        </span>
      </div>

      {change !== null && (
        <div className="flex items-center gap-1">
          <ChangeTrendIcon className={`w-4 h-4 ${changeColor}`} />
          <span className={`text-sm font-medium ${changeColor}`}>
            {isPositive ? '+' : ''}{Number(change).toFixed(2)}%
          </span>
          {changeLabel && (
            <span className="text-xs text-gray-400 ml-1">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default MetricCard;
