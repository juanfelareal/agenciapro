import { useEffect, useState } from 'react';
import { expensesAPI, projectsAPI } from '../utils/api';
import { Plus, Edit, Trash2, X } from 'lucide-react';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    category: '',
    amount: 0,
    project_id: '',
    expense_date: '',
    payment_method: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [expensesRes, projectsRes] = await Promise.all([
        expensesAPI.getAll(),
        projectsAPI.getAll(),
      ]);
      setExpenses(expensesRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await expensesAPI.update(editingExpense.id, formData);
      } else {
        await expensesAPI.create(formData);
      }
      setShowModal(false);
      setEditingExpense(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Error al guardar gasto');
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      category: expense.category || '',
      amount: expense.amount,
      project_id: expense.project_id || '',
      expense_date: expense.expense_date,
      payment_method: expense.payment_method || '',
      notes: expense.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar este gasto?')) return;
    try {
      await expensesAPI.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      description: '',
      category: '',
      amount: 0,
      project_id: '',
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: '',
      notes: '',
    });
  };

  const handleNew = () => {
    resetForm();
    setEditingExpense(null);
    setShowModal(true);
  };

  const categories = [
    'Software',
    'Hardware',
    'Marketing',
    'Oficina',
    'Servicios',
    'Salarios',
    'Transporte',
    'Otro',
  ];

  const paymentMethods = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque'];

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Gastos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registro de gastos y egresos</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-[#1A1A2E] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#252542] transition-colors"
        >
          <Plus size={20} />
          Nuevo Gasto
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Total de Gastos</p>
        <p className="text-4xl font-black text-[#F97316] tabular-nums">
          ${totalExpenses.toLocaleString('es-CO')}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Categoría
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Proyecto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Método Pago
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-[#1A1A2E]">{expense.description}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {expense.category && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs">
                      {expense.category}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{expense.project_name || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap font-bold text-[#F97316]">
                  ${expense.amount?.toLocaleString('es-CO')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{expense.expense_date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{expense.payment_method || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleEdit(expense)}
                    className="text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 p-1.5 rounded-lg mr-2 transition-colors"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">
                {editingExpense ? 'Editar Gasto' : 'Nuevo Gasto'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Descripción *</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Categoría</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Seleccione...</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Monto *</label>
                  <input
                    type="number"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Proyecto</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  >
                    <option value="">Sin proyecto</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Método de Pago</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  >
                    <option value="">Seleccione...</option>
                    {paymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Notas</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2"
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
