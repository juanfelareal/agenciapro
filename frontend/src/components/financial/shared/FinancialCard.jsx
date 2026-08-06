/**
 * Financial Card wrapper component
 * Consistent card styling for financial dashboard sections
 */
const FinancialCard = ({ title, subtitle, action, children, className = '', span = 12 }) => {
  const spanClasses = {
    4: 'col-span-12 lg:col-span-4',
    6: 'col-span-12 lg:col-span-6',
    8: 'col-span-12 lg:col-span-8',
    12: 'col-span-12',
  };

  return (
    <div className={`bg-[#1a1b23] border border-white/5 rounded-2xl p-6 ${spanClasses[span]} ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex justify-between items-start mb-5">
          <div>
            {title && <h3 className="text-[15px] font-semibold mb-0.5">{title}</h3>}
            {subtitle && <p className="text-xs text-[#5c5d66]">{subtitle}</p>}
          </div>
          {action && <div className="text-xs text-indigo-400 cursor-pointer">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default FinancialCard;
