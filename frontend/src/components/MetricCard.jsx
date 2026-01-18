import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * MetricCard - Reusable card component for displaying metrics
 * Glassmorphism style with modern design
 */
function MetricCard({
  title,
  value,
  icon: Icon,
  iconBgColor = 'bg-accent/10',
  iconColor = 'text-accent-600',
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
  const changeColor = isPositive ? 'text-green-600' : 'text-red-500';
  const changeBgColor = isPositive ? 'bg-green-50' : 'bg-red-50';
  const ChangeTrendIcon = isPositive ? TrendingUp : TrendingDown;

  if (loading) {
    return (
      <div className="card-interactive p-5 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-ink-200/50 rounded-lg w-24"></div>
          <div className="w-11 h-11 bg-ink-200/50 rounded-xl"></div>
        </div>
        <div className="h-9 bg-ink-200/50 rounded-lg w-32 mb-3"></div>
        <div className="h-4 bg-ink-200/50 rounded-lg w-20"></div>
      </div>
    );
  }

  return (
    <div className="card-interactive p-5 group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-ink-500 font-medium tracking-tight">{title}</span>
        {Icon && (
          <div className={`w-11 h-11 ${iconBgColor} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>

      <div className="mb-3">
        <span className="text-2xl font-semibold text-ink-900 tracking-tight">
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
            <span className="text-xs text-ink-400">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default MetricCard;
