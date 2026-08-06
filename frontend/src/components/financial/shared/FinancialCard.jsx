/**
 * Financial Card wrapper component
 * Uses platform's glass design system (light theme)
 */
const FinancialCard = ({ title, subtitle, action, children, className = '', span = 12 }) => {
  const spanClasses = {
    4: 'col-span-12 lg:col-span-4',
    6: 'col-span-12 lg:col-span-6',
    8: 'col-span-12 lg:col-span-8',
    12: 'col-span-12',
  };

  return (
    <div className={`glass rounded-2xl p-6 ${spanClasses[span]} ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex justify-between items-start mb-5">
          <div>
            {title && <h3 className="text-[15px] font-semibold text-[#17181A] mb-0.5">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          {action && (
            <button className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
              {action}
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

export default FinancialCard;
