import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Check, 
  Trash2, 
  Flame, 
  Search, 
  DollarSign, 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  User,
  X,
  Edit2,
  Receipt,
  Apple,
  Wheat,
  Milk,
  Package,
  Coffee,
  Tag,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { ShoppingItem, ShoppingCategory, ShoppingPriority, Roommate } from '../types';
import { 
  addShoppingItem, 
  updateShoppingItem, 
  toggleShoppingItemCompleted, 
  deleteShoppingItem, 
  clearCompletedShoppingItems, 
  subscribeShoppingList,
  convertShoppingItemToExpense 
} from '../dbService';

interface ShoppingListProps {
  activeRoommate: Roommate;
  onOpenExpenseModalWithData?: (data: { title: string; amount: number; category: string }) => void;
}

interface CategoryConfig {
  name: ShoppingCategory;
  Icon: React.FC<{ className?: string }>;
  bgColor: string;
  textColor: string;
}

const CATEGORIES: CategoryConfig[] = [
  { name: 'Produce & Groceries', Icon: Apple, bgColor: 'bg-emerald-100', textColor: 'text-emerald-900' },
  { name: 'Pantry & Grains', Icon: Wheat, bgColor: 'bg-amber-100', textColor: 'text-amber-900' },
  { name: 'Dairy & Refrigerated', Icon: Milk, bgColor: 'bg-blue-100', textColor: 'text-blue-900' },
  { name: 'Household & Cleaning', Icon: Sparkles, bgColor: 'bg-purple-100', textColor: 'text-purple-900' },
  { name: 'Snacks & Beverages', Icon: Coffee, bgColor: 'bg-orange-100', textColor: 'text-orange-900' },
  { name: 'Other', Icon: Package, bgColor: 'bg-slate-100', textColor: 'text-slate-900' }
];

const PRESETS = [
  { title: 'Basmati Rice', quantity: '5 kg', category: 'Pantry & Grains' as ShoppingCategory, priority: 'Urgent (Running Low)' as ShoppingPriority },
  { title: 'Milk', quantity: '2 Litres', category: 'Dairy & Refrigerated' as ShoppingCategory, priority: 'Normal' as ShoppingPriority },
  { title: 'Eggs', quantity: '1 Dozen', category: 'Dairy & Refrigerated' as ShoppingCategory, priority: 'Normal' as ShoppingPriority },
  { title: 'Olive Oil', quantity: '1 Bottle', category: 'Pantry & Grains' as ShoppingCategory, priority: 'Urgent (Running Low)' as ShoppingPriority },
  { title: 'Trash Bags', quantity: '1 Pack', category: 'Household & Cleaning' as ShoppingCategory, priority: 'Normal' as ShoppingPriority },
  { title: 'Dishwasher Tablets', quantity: '1 Box', category: 'Household & Cleaning' as ShoppingCategory, priority: 'Normal' as ShoppingPriority }
];

export const ShoppingList: React.FC<ShoppingListProps> = ({ activeRoommate }) => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Add Bar state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState<ShoppingCategory>('Pantry & Grains');
  const [quickPriority, setQuickPriority] = useState<ShoppingPriority>('Normal');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<'all' | 'needed' | 'urgent' | 'completed'>('needed');

  // Modal / Conversion dialog state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);

  // Form fields for Add/Edit modal
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState<ShoppingCategory>('Pantry & Grains');
  const [priority, setPriority] = useState<ShoppingPriority>('Normal');
  const [notes, setNotes] = useState('');

  // Convert to Expense Modal
  const [convertingItem, setConvertingItem] = useState<ShoppingItem | null>(null);
  const [convertAmount, setConvertAmount] = useState<string>('');
  const [convertPaidBy, setConvertPaidBy] = useState<Roommate>(activeRoommate);
  const [convertNotes, setConvertNotes] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeShoppingList((data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    await addShoppingItem({
      title: quickTitle.trim(),
      category: quickCategory,
      priority: quickPriority,
      addedBy: activeRoommate,
      completed: false
    });

    setQuickTitle('');
  };

  const handlePresetAdd = async (preset: typeof PRESETS[0]) => {
    await addShoppingItem({
      title: preset.title,
      quantity: preset.quantity,
      category: preset.category,
      priority: preset.priority,
      addedBy: activeRoommate,
      completed: false
    });
  };

  const openAddModal = (itemToEdit?: ShoppingItem) => {
    if (itemToEdit) {
      setEditingItem(itemToEdit);
      setTitle(itemToEdit.title);
      setQuantity(itemToEdit.quantity || '');
      setCategory(itemToEdit.category);
      setPriority(itemToEdit.priority);
      setNotes(itemToEdit.notes || '');
    } else {
      setEditingItem(null);
      setTitle('');
      setQuantity('');
      setCategory('Pantry & Grains');
      setPriority('Normal');
      setNotes('');
    }
    setIsAddModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingItem && editingItem.id) {
      await updateShoppingItem(editingItem.id, {
        title: title.trim(),
        quantity: quantity.trim() || undefined,
        category,
        priority,
        notes: notes.trim() || undefined
      }, activeRoommate);
    } else {
      await addShoppingItem({
        title: title.trim(),
        quantity: quantity.trim() || undefined,
        category,
        priority,
        addedBy: activeRoommate,
        completed: false,
        notes: notes.trim() || undefined
      });
    }

    setIsAddModalOpen(false);
  };

  const handleToggleComplete = async (item: ShoppingItem) => {
    if (!item.id) return;
    await toggleShoppingItemCompleted(item.id, !item.completed, activeRoommate);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this item from the shopping list?')) {
      await deleteShoppingItem(id);
    }
  };

  const handleClearCompleted = async () => {
    if (window.confirm('Clear all completed/bought items from the list?')) {
      await clearCompletedShoppingItems();
    }
  };

  const openConvertModal = (item: ShoppingItem) => {
    setConvertingItem(item);
    setConvertAmount(item.estimatedCost ? String(item.estimatedCost) : '');
    setConvertPaidBy(activeRoommate);
    setConvertNotes(`Purchased ${item.title}${item.quantity ? ` (${item.quantity})` : ''} at grocery store.`);
  };

  const handleSaveConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingItem || !convertAmount) return;
    const numAmount = parseFloat(convertAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid expense amount in Euros.');
      return;
    }

    await convertShoppingItemToExpense(convertingItem, numAmount, convertPaidBy, convertNotes);
    setConvertingItem(null);
  };

  // Filter calculations
  const filteredItems = items.filter(item => {
    if (filterStatus === 'needed' && item.completed) return false;
    if (filterStatus === 'completed' && !item.completed) return false;
    if (filterStatus === 'urgent' && (item.completed || item.priority !== 'Urgent (Running Low)')) return false;

    if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchQty = item.quantity?.toLowerCase().includes(q) || false;
      const matchNotes = item.notes?.toLowerCase().includes(q) || false;
      const matchCategory = item.category.toLowerCase().includes(q);
      if (!matchTitle && !matchQty && !matchNotes && !matchCategory) return false;
    }

    return true;
  });

  const neededCount = items.filter(i => !i.completed).length;
  const urgentCount = items.filter(i => !i.completed && i.priority === 'Urgent (Running Low)').length;
  const completedCount = items.filter(i => i.completed).length;

  return (
    <div className="space-y-4 max-w-5xl mx-auto font-sans pb-6">
      {/* Header Banner - Compact & Clean */}
      <div className="bg-white border-2 border-slate-900 rounded-2xl p-3.5 sm:p-5 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-slate-900 text-[10px] font-black uppercase tracking-wider mb-1 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
              <ShoppingBag className="w-3 h-3 text-indigo-700 stroke-[2.5px]" />
              Shared Grocery Hub
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Roommate Shopping List
            </h1>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {completedCount > 0 && (
              <button
                onClick={handleClearCompleted}
                className="px-2.5 py-1.5 text-[11px] font-black uppercase text-slate-800 bg-slate-100 hover:bg-rose-100 hover:text-rose-950 rounded-xl border border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-700 stroke-[2.5px]" />
                Clear ({completedCount})
              </button>
            )}

            <button
              onClick={() => openAddModal()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl border border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1.5 min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              Add Item
            </button>
          </div>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-900">
          <div className="bg-indigo-50/80 border border-slate-900 rounded-xl p-2 sm:p-2.5 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] text-center sm:text-left">
            <div className="text-slate-600 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">Needed</div>
            <div className="text-lg sm:text-xl font-black font-mono text-indigo-950 mt-0.5">{neededCount}</div>
          </div>

          <div className={`border border-slate-900 rounded-xl p-2 sm:p-2.5 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] text-center sm:text-left ${
            urgentCount > 0 ? 'bg-amber-100' : 'bg-slate-50'
          }`}>
            <div className="text-amber-950 text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
              <Flame className="w-3 h-3 text-amber-700 stroke-[2.5px]" />
              Urgent
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-amber-950 mt-0.5">{urgentCount}</div>
          </div>

          <div className="bg-emerald-50/80 border border-slate-900 rounded-xl p-2 sm:p-2.5 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] text-center sm:text-left">
            <div className="text-emerald-950 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">Bought</div>
            <div className="text-lg sm:text-xl font-black font-mono text-emerald-950 mt-0.5">{completedCount}</div>
          </div>
        </div>
      </div>

      {/* Quick Add Bar */}
      <div className="bg-white border-2 border-slate-900 rounded-2xl p-3 sm:p-4 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)]">
        <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Quick add (e.g. Rice, Milk, Eggs)..."
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-xs font-bold bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600 transition min-h-[38px]"
            />
            {quickTitle && (
              <button
                type="button"
                onClick={() => setQuickTitle('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5px]" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={quickCategory}
              onChange={(e) => setQuickCategory(e.target.value as ShoppingCategory)}
              className="py-2 px-2 text-[11px] font-bold bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:border-indigo-600 text-slate-800 flex-1 sm:flex-initial min-h-[38px]"
            >
              {CATEGORIES.map(c => (
                <option key={c.name} value={c.name}>{c.name.replace('/Delivery', '').replace(' (Coins)', '')}</option>
              ))}
            </select>

            <select
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value as ShoppingPriority)}
              className="py-2 px-2 text-[11px] font-bold bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:border-indigo-600 text-slate-800 shrink-0 min-h-[38px]"
            >
              <option value="Normal">Normal</option>
              <option value="Urgent (Running Low)">Urgent</option>
              <option value="Low">Low</option>
            </select>

            <button
              type="submit"
              disabled={!quickTitle.trim()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black rounded-xl border border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 min-h-[38px]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              Add
            </button>
          </div>
        </form>

        {/* Quick Presets */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 whitespace-nowrap shrink-0">
            <Sparkles className="w-3 h-3 text-indigo-600 stroke-[2.5px]" />
            Suggestions:
          </span>
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handlePresetAdd(p)}
              className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-indigo-100 text-slate-900 font-bold rounded-lg border border-slate-900 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shrink-0"
            >
              <span>+ {p.title}</span>
              {p.quantity && <span className="text-slate-500 font-normal">({p.quantity})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border-2 border-slate-900 rounded-2xl p-3 sm:p-4 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Status Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-900 text-center">
            <button
              onClick={() => setFilterStatus('needed')}
              className={`py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer truncate ${
                filterStatus === 'needed' 
                  ? 'bg-indigo-600 text-white border border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]' 
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Needed ({neededCount})
            </button>
            <button
              onClick={() => setFilterStatus('urgent')}
              className={`py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer truncate flex items-center justify-center gap-0.5 ${
                filterStatus === 'urgent' 
                  ? 'bg-amber-400 text-slate-950 border border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]' 
                  : 'text-amber-800 hover:bg-amber-100'
              }`}
            >
              <Flame className="w-3 h-3 stroke-[2.5px] hidden sm:inline" />
              Urgent ({urgentCount})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer truncate ${
                filterStatus === 'completed' 
                  ? 'bg-emerald-500 text-white border border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]' 
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Bought ({completedCount})
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer truncate ${
                filterStatus === 'all' 
                  ? 'bg-slate-900 text-white border border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]' 
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              All ({items.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 stroke-[2.5px] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search groceries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pt-0.5 pb-0.5 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-2 py-0.5 text-[10px] font-black rounded-lg border border-slate-900 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              selectedCategory === 'All'
                ? 'bg-slate-900 text-white shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                : 'bg-slate-50 text-slate-800 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => {
            const CategoryIcon = cat.Icon;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-2 py-0.5 text-[10px] font-black rounded-lg border border-slate-900 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shrink-0 ${
                  selectedCategory === cat.name
                    ? 'bg-indigo-600 text-white shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                    : 'bg-slate-50 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <CategoryIcon className="w-3 h-3 stroke-[2.5px]" />
                <span>{cat.name.replace(' & Groceries', '').replace(' & Grains', '').replace(' & Refrigerated', '').replace(' & Cleaning', '').replace(' & Beverages', '')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shopping List Items Grid */}
      {loading ? (
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-8 text-center shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)]">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-indigo-600 border-t-transparent"></div>
          <p className="text-slate-800 text-xs mt-2 font-bold uppercase tracking-wider">Loading list...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-8 text-center shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)]">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-800 rounded-xl border border-slate-900 flex items-center justify-center mx-auto mb-3 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
            <ShoppingBag className="w-6 h-6 stroke-[2.5px]" />
          </div>
          <h3 className="text-base font-black text-slate-900 uppercase">
            {filterStatus === 'needed' ? 'Pantry is stocked!' : 'No matching items'}
          </h3>
          <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto mt-0.5">
            {filterStatus === 'needed' 
              ? 'Click "Add Item" or select suggestions when running low.'
              : 'Try clearing your search or category filter.'}
          </p>
          <button
            onClick={() => openAddModal()}
            className="mt-4 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl border border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3px]" />
            Add First Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredItems.map((item) => {
            const catInfo = CATEGORIES.find(c => c.name === item.category) || CATEGORIES[5];
            const CategoryIcon = catInfo.Icon;
            const isUrgent = item.priority === 'Urgent (Running Low)';

            return (
              <div
                key={item.id}
                className={`border-2 border-slate-900 rounded-xl p-3 transition-all duration-150 relative flex flex-col justify-between ${
                  item.completed
                    ? 'bg-slate-100/90 border-slate-400'
                    : isUrgent
                    ? 'bg-amber-50 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'bg-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                }`}
              >
                <div>
                  {/* Card Top Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleComplete(item)}
                        className="mt-0.5 cursor-pointer transition-transform active:scale-90 shrink-0"
                        title={item.completed ? 'Mark as needed' : 'Mark as bought'}
                      >
                        {item.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 stroke-[2.5px]" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-400 hover:text-indigo-600 stroke-[2.5px]" />
                        )}
                      </button>

                      {/* Title & Qty */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className={`text-sm font-black truncate max-w-[180px] sm:max-w-none ${
                            item.completed ? 'line-through text-slate-500' : 'text-slate-900'
                          }`}>
                            {item.title}
                          </h4>

                          {item.quantity && (
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-900 font-bold font-mono text-[10px] rounded border border-slate-900">
                              {item.quantity}
                            </span>
                          )}
                        </div>

                        {/* Category & Priority Badge */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-bold rounded border border-slate-900 ${catInfo.bgColor} ${catInfo.textColor}`}>
                            <CategoryIcon className="w-3 h-3 stroke-[2.5px]" />
                            <span>{item.category.replace(' & Groceries', '').replace(' & Grains', '').replace(' & Refrigerated', '').replace(' & Cleaning', '').replace(' & Beverages', '')}</span>
                          </span>

                          {isUrgent && !item.completed && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-black text-amber-950 bg-amber-400 border border-slate-900 rounded">
                              <AlertTriangle className="w-3 h-3 text-amber-950 stroke-[2.5px]" />
                              Low
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => openAddModal(item)}
                        className="p-1 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded border border-transparent hover:border-slate-900 transition cursor-pointer"
                        title="Edit Item"
                      >
                        <Edit2 className="w-3.5 h-3.5 stroke-[2.5px]" />
                      </button>
                      <button
                        onClick={() => item.id && handleDelete(item.id)}
                        className="p-1 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded border border-transparent hover:border-slate-900 transition cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[2.5px]" />
                      </button>
                    </div>
                  </div>

                  {/* Notes if any */}
                  {item.notes && (
                    <p className="text-[10px] text-slate-600 font-medium italic mt-1.5 ml-7 bg-slate-50/80 px-2 py-1 rounded-lg border border-slate-200">
                      "{item.notes}"
                    </p>
                  )}
                </div>

                {/* Card Bottom Row */}
                <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] font-bold text-slate-700">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-slate-100 rounded border border-slate-900 text-slate-900 text-[9px]">
                      <User className="w-3 h-3 text-indigo-600 stroke-[2.5px]" />
                      <span>{item.addedBy}</span>
                    </span>

                    {item.completed && item.completedBy && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-900 font-bold bg-emerald-100 px-1.5 py-0.2 rounded border border-slate-900 text-[9px]">
                        <UserCheck className="w-3 h-3 text-emerald-700 stroke-[2.5px]" />
                        Bought by {item.completedBy}
                      </span>
                    )}
                  </div>

                  {/* Convert to Shared Expense Button */}
                  {item.convertedToExpenseId ? (
                    <span className="inline-flex items-center gap-1 text-emerald-950 font-bold bg-emerald-100 px-2 py-0.5 rounded-lg border border-slate-900 text-[9px]">
                      <Receipt className="w-3 h-3 text-emerald-700 stroke-[2.5px]" />
                      Split
                      {item.estimatedCost && ` (€${item.estimatedCost.toFixed(2)})`}
                    </span>
                  ) : (
                    <button
                      onClick={() => openConvertModal(item)}
                      className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-lg border border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1 text-[10px]"
                      title="Mark bought and split as shared expense"
                    >
                      <DollarSign className="w-3 h-3 stroke-[2.5px]" />
                      Split Expense
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border-3 border-slate-900 rounded-2xl max-w-md w-full shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans my-auto">
            <div className="bg-slate-900 text-white p-3.5 border-b-2 border-slate-900 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-400 stroke-[2.5px]" />
                {editingItem ? 'Edit Item' : 'Add Shopping Item'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-300 hover:text-white transition p-1 cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.5px]" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-800 uppercase tracking-wider mb-1 font-mono">
                  Item Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basmati Rice, Olive Oil, Eggs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-800 uppercase tracking-wider mb-1 font-mono">
                    Quantity
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5kg, 2 packs"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-800 uppercase tracking-wider mb-1 font-mono">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ShoppingPriority)}
                    className="w-full px-2.5 py-2 text-xs font-bold bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent (Running Low)">Urgent</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-800 uppercase tracking-wider mb-1 font-mono">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ShoppingCategory)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:border-indigo-600"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-800 uppercase tracking-wider mb-1 font-mono">
                  Notes / Brand preference
                </label>
                <input
                  type="text"
                  placeholder="Brand preference or extra notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl border border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer min-h-[38px]"
                >
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Item to Shared Expense Modal */}
      {convertingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border-3 border-slate-900 rounded-2xl max-w-md w-full shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans my-auto">
            <div className="bg-emerald-700 text-white p-3.5 border-b-2 border-slate-900 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-200 stroke-[2.5px]" />
                Split Shared Expense
              </h3>
              <button
                onClick={() => setConvertingItem(null)}
                className="text-emerald-100 hover:text-white transition p-1 cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.5px]" />
              </button>
            </div>

            <form onSubmit={handleSaveConversion} className="p-4 space-y-3">
              <div className="p-2.5 bg-emerald-50 border border-slate-900 rounded-xl shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                <div className="text-[9px] text-emerald-950 font-black uppercase tracking-wider font-mono">Selected Item:</div>
                <div className="text-sm font-black text-emerald-950 mt-0.5">
                  {convertingItem.title} {convertingItem.quantity ? `(${convertingItem.quantity})` : ''}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-800 uppercase tracking-wider mb-1 font-mono">
                  Actual Amount Paid (€) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-700 text-sm">€</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-base font-black font-mono bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-600"
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-bold mt-1">Split 50/50 in shared ledger.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-800 uppercase tracking-wider mb-1 font-mono">
                  Paid By
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Ozric', 'Pawan'] as Roommate[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setConvertPaidBy(r)}
                      className={`py-2 px-3 rounded-xl font-black text-xs border border-slate-900 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        convertPaidBy === r
                          ? 'bg-emerald-500 text-white shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]'
                          : 'bg-slate-50 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <User className="w-3.5 h-3.5 stroke-[2.5px]" />
                      <span>{r}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-800 uppercase tracking-wider mb-1 font-mono">
                  Notes
                </label>
                <input
                  type="text"
                  value={convertNotes}
                  onChange={(e) => setConvertNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setConvertingItem(null)}
                  className="px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl border border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1 min-h-[38px]"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                  Log Shared Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
