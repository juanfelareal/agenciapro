/**
 * DataTable component for financial dashboard
 * Uses platform's glass design system (light theme)
 * Supports expandable rows for employee detail
 */
const DataTable = ({ columns, data, className = '' }) => {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                className={`text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 ${
                  col.align === 'right' ? 'text-right' : ''
                } ${col.align === 'center' ? 'text-center' : ''} ${col.className || ''}`}
                style={{ minWidth: col.minWidth }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={row.id || rowIdx}
              className={`group ${row.className || ''} ${row.onClick ? 'cursor-pointer' : ''}`}
              onClick={row.onClick}
              style={row.style}
            >
              {columns.map((col, colIdx) => (
                <td
                  key={col.key || colIdx}
                  className={`px-4 py-3.5 text-[13px] text-[#17181A] border-b border-gray-100 group-hover:bg-white/60 transition-colors ${
                    col.align === 'right' ? 'text-right font-semibold' : ''
                  } ${col.align === 'center' ? 'text-center' : ''} ${row.cells?.[col.key]?.className || ''}`}
                  style={row.cells?.[col.key]?.style}
                >
                  {row.cells?.[col.key]?.render || row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
