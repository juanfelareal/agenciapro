import { useState } from 'react';
import { ChevronUp, ChevronDown, Download } from 'lucide-react';

/**
 * MetricsTable - Table component for displaying daily/weekly metrics
 * Similar to Master Metrics style with sorting and export
 */
function MetricsTable({
  data = [],
  columns = [],
  title = '',
  loading = false,
  emptyMessage = 'No hay datos disponibles'
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

  // Format value based on column type
  const formatValue = (value, type) => {
    if (value === null || value === undefined) return '-';

    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
      case 'percent':
        return `${Number(value).toFixed(2)}%`;
      case 'decimal':
        return Number(value).toFixed(2);
      case 'integer':
        return new Intl.NumberFormat('es-CO').format(Math.round(value));
      case 'date':
        return new Date(value + 'T00:00:00').toLocaleDateString('es-CO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      default:
        return value;
    }
  };

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (typeof aValue === 'string') {
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
  });

  // Handle sort click
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = columns.map((col) => col.label).join(',');
    const rows = data.map((row) =>
      columns.map((col) => {
        const value = row[col.key];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value ?? '';
      }).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        {title && <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse"></div>}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {sortConfig.key === column.key && (
                      sortConfig.direction === 'asc'
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 text-sm ${column.align === 'right' ? 'text-right' : 'text-left'} ${column.className || ''}`}
                    >
                      {formatValue(row[column.key], column.type)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MetricsTable;
