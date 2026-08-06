/**
 * DataTable component for financial dashboard
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
                className={`text-left px-4 py-3 text-[11px] font-semibold text-[#5c5d66] uppercase tracking-wider border-b border-white/5 ${
                  col.align === 'right' ? 'text-right' : ''
                } ${col.className || ''}`}
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
                  className={`px-4 py-3.5 text-[13px] border-b border-white/5 group-hover:bg-[#22232d] transition-colors ${
                    col.align === 'right' ? 'text-right font-semibold' : ''
                  } ${row.cells?.[col.key]?.className || ''}`}
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
