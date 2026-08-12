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
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      {/* Header Banner - Matched to Neobrutalist Theme */}
      <div className="bg-white border-2 md:border-3 border-slate-900 rounded-2xl p-5 md:p-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] md:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-900 border-2 border-slate-900 text-xs font-black uppercase tracking-wider mb-2.5 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
              <ShoppingBag className="w-3.5 h-3.5 text-indigo-700 stroke-[2.5px]" />
              Shared Grocery Hub
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Roommate Shopping List
            </h1>
            <p className="text-slate-600 text-sm font-semibold mt-1">
              Add shared household items when running low so either roommate can buy and split them!
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {completedCount > 0 && (
              <button
                onClick={handleClearCompleted}
                className="px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-800 bg-slate-100 hover:bg-rose-100 hover:text-rose-950 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4 text-slate-700 stroke-[2.5px]" />
                Clear Completed ({completedCount})
              </button>
            )}

            <button
              onClick={() => openAddModal()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              Add Shopping Item
            </button>
          </div>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t-2 border-slate-900">
          <div className="bg-indigo-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <div className="text-slate-700 text-xs font-black uppercase tracking-wider">Needed Items</div>
            <div className="text-2xl font-black font-mono text-indigo-950 mt-0.5">{neededCount}</div>
          </div>

          <div className={`border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] ${
            urgentCount > 0 ? 'bg-amber-100' : 'bg-slate-50'
          }`}>
            <div className="text-amber-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-700 stroke-[2.5px]" />
              Urgent / Low
            </div>
            <div className="text-2xl font-black font-mono text-amber-950 mt-0.5">{urgentCount}</div>
          </div>

          <div className="bg-emerald-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] col-span-2 sm:col-span-1">
            <div className="text-emerald-950 text-xs font-black uppercase tracking-wider">Bought / Cart</div>
            <div className="text-2xl font-black font-mono text-emerald-950 mt-0.5">{completedCount}</div>
          </div>
        </div>
      </div>

      {/* Quick Add Bar */}
      <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Quick add item (e.g. Rice 5kg, Milk, Eggs)..."
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 text-sm font-bold bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            />
            {quickTitle && (
              <button
                type="button"
                onClick={() => setQuickTitle('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4 stroke-[2.5px]" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={quickCategory}
              onChange={(e) => setQuickCategory(e.target.value as ShoppingCategory)}
              className="py-2.5 px-3 text-xs font-bold bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:border-indigo-600 text-slate-800"
            >
              {CATEGORIES.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value as ShoppingPriority)}
              className="py-2.5 px-3 text-xs font-bold bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:border-indigo-600 text-slate-800"
            >
              <option value="Normal">Normal</option>
              <option value="Urgent (Running Low)">Urgent</option>
              <option value="Low">Low</option>
            </select>

            <button
              type="submit"
              disabled={!quickTitle.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              Add
            </button>
          </div>
        </form>

        {/* Quick Presets */}
        <div className="mt-3.5 pt-3 border-t-2 border-slate-900 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5px]" />
            Quick Suggestions:
          </span>
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handlePresetAdd(p)}
              className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-indigo-100 text-slate-900 font-bold rounded-lg border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
            >
              <span>+ {p.title}</span>
              {p.quantity && <span className="text-slate-600 font-medium">({p.quantity})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border-2 border-slate-900">
            <button
              onClick={() => setFilterStatus('needed')}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                filterStatus === 'needed' 
                  ? 'bg-indigo-600 text-white border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]' 
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Needed ({neededCount})
            </button>
            <button
              onClick={() => setFilterStatus('urgent')}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                filterStatus === 'urgent' 
                  ? 'bg-amber-400 text-slate-950 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]' 
                  : 'text-amber-800 hover:bg-amber-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5 stroke-[2.5px]" />
              Urgent ({urgentCount})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                filterStatus === 'completed' 
                  ? 'bg-emerald-500 text-white border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]' 
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Bought ({completedCount})
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                filterStatus === 'all' 
                  ? 'bg-slate-900 text-white border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]' 
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              All ({items.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-500 stroke-[2.5px] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search shopping list..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-bold bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-2.5 py-1 text-xs font-black rounded-lg border-2 border-slate-900 transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'All'
                ? 'bg-slate-900 text-white shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]'
                : 'bg-slate-50 text-slate-800 hover:bg-slate-100 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => {
            const CategoryIcon = cat.Icon;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-2.5 py-1 text-xs font-black rounded-lg border-2 border-slate-900 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === cat.name
                    ? 'bg-indigo-600 text-white shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]'
                    : 'bg-slate-50 text-slate-800 hover:bg-slate-100 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                }`}
              >
                <CategoryIcon className="w-3.5 h-3.5 stroke-[2.5px]" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shopping List Items Grid */}
      {loading ? (
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-12 text-center shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-slate-800 text-sm mt-3 font-bold uppercase tracking-wider">Loading grocery list...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-12 text-center shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-800 rounded-2xl border-2 border-slate-900 flex items-center justify-center mx-auto mb-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <ShoppingBag className="w-8 h-8 stroke-[2.5px]" />
          </div>
          <h3 className="text-lg font-black text-slate-900 uppercase">
            {filterStatus === 'needed' ? 'No Needed Items!' : 'No items match your filter'}
          </h3>
          <p className="text-slate-600 text-sm font-semibold max-w-md mx-auto mt-1">
            {filterStatus === 'needed' 
              ? 'Pantry looks well stocked! Click "Add Shopping Item" or use suggestions above when running low.'
              : 'Try adjusting your search query or category filters.'}
          </p>
          <button
            onClick={() => openAddModal()}
            className="mt-5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            Add First Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const catInfo = CATEGORIES.find(c => c.name === item.category) || CATEGORIES[5];
            const CategoryIcon = catInfo.Icon;
            const isUrgent = item.priority === 'Urgent (Running Low)';

            return (
              <div
                key={item.id}
                className={`border-2 border-slate-900 rounded-2xl p-4 transition-all duration-200 relative group flex flex-col justify-between ${
                  item.completed
                    ? 'bg-slate-100 opacity-80 border-slate-400'
                    : isUrgent
                    ? 'bg-amber-50 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
                    : 'bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
                }`}
              >
                <div>
                  {/* Card Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleComplete(item)}
                        className="mt-0.5 cursor-pointer transition-transform active:scale-95 flex-shrink-0"
                        title={item.completed ? 'Mark as needed' : 'Mark as bought'}
                      >
                        {item.completed ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 stroke-[2.5px]" />
                        ) : (
                          <Circle className="w-6 h-6 text-slate-400 hover:text-indigo-600 stroke-[2.5px]" />
                        )}
                      </button>

                      {/* Title & Qty */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-base font-black ${
                            item.completed ? 'line-through text-slate-500' : 'text-slate-900'
                          }`}>
                            {item.title}
                          </h4>

                          {item.quantity && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-900 font-bold font-mono text-xs rounded-md border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                              {item.quantity}
                            </span>
                          )}
                        </div>

                        {/* Category & Priority Badge */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-lg border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] ${catInfo.bgColor} ${catInfo.textColor}`}>
                            <CategoryIcon className="w-3.5 h-3.5 stroke-[2.5px]" />
                            <span>{item.category}</span>
                          </span>

                          {isUrgent && !item.completed && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-black text-amber-950 bg-amber-400 border-2 border-slate-900 rounded-lg shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-950 stroke-[2.5px]" />
                              Running Low
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openAddModal(item)}
                        className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg border-2 border-transparent hover:border-slate-900 transition cursor-pointer"
                        title="Edit Item"
                      >
                        <Edit2 className="w-4 h-4 stroke-[2.5px]" />
                      </button>
                      <button
                        onClick={() => item.id && handleDelete(item.id)}
                        className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border-2 border-transparent hover:border-slate-900 transition cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4 stroke-[2.5px]" />
                      </button>
                    </div>
                  </div>

                  {/* Notes if any */}
                  {item.notes && (
                    <p className="text-xs text-slate-700 font-medium italic mt-2.5 ml-9 bg-slate-50 p-2.5 rounded-xl border-2 border-slate-900">
                      "{item.notes}"
                    </p>
                  )}
                </div>

                {/* Card Bottom Row: Added by info & Convert to Shared Expense */}
                <div className="mt-4 pt-3 border-t-2 border-slate-900 flex items-center justify-between text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-lg border-2 border-slate-900 text-slate-900">
                      <User className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5px]" />
                      <span>{item.addedBy}</span>
                    </span>

                    {item.completed && item.completedBy && (
                      <span className="inline-flex items-center gap-1 text-emerald-900 font-bold bg-emerald-100 px-2 py-0.5 rounded-lg border-2 border-slate-900">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5px]" />
                        Bought by {item.completedBy}
                      </span>
                    )}
                  </div>

                  {/* Convert to Shared Expense Button */}
                  {item.convertedToExpenseId ? (
                    <span className="inline-flex items-center gap-1 text-emerald-950 font-bold bg-emerald-100 px-2.5 py-1 rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                      <Receipt className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5px]" />
                      Expense Split
                      {item.estimatedCost && ` (€${item.estimatedCost.toFixed(2)})`}
                    </span>
                  ) : (
                    <button
                      onClick={() => openConvertModal(item)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center gap-1 text-xs"
                      title="Mark bought and split as shared expense"
                    >
                      <DollarSign className="w-3.5 h-3.5 stroke-[2.5px]" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-3 border-slate-900 rounded-2xl max-w-md w-full shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="bg-slate-900 text-white p-4 border-b-2 border-slate-900 flex items-center justify-between">
              <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-400 stroke-[2.5px]" />
                {editingItem ? 'Edit Shopping Item' : 'Add New Shopping Item'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-300 hover:text-white transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5px]" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Item Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basmati Rice, Olive Oil, Eggs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Quantity / Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5kg, 2 packs"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ShoppingPriority)}
                    className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent (Running Low)">Urgent (Running Low)</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ShoppingCategory)}
                  className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:border-indigo-600"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Notes / Brand preference (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Get Tilda brand if on discount, or organic milk"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t-2 border-slate-900">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Add to List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Item to Shared Expense Modal */}
      {convertingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-3 border-slate-900 rounded-2xl max-w-md w-full shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="bg-emerald-700 text-white p-4 border-b-2 border-slate-900 flex items-center justify-between">
              <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-200 stroke-[2.5px]" />
                Convert Item to Shared Expense
              </h3>
              <button
                onClick={() => setConvertingItem(null)}
                className="text-emerald-100 hover:text-white transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5px]" />
              </button>
            </div>

            <form onSubmit={handleSaveConversion} className="p-5 space-y-4">
              <div className="p-3 bg-emerald-50 border-2 border-slate-900 rounded-xl shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                <div className="text-xs text-emerald-950 font-black uppercase tracking-wider">Selected Item:</div>
                <div className="text-base font-black text-emerald-950 mt-0.5">
                  {convertingItem.title} {convertingItem.quantity ? `(${convertingItem.quantity})` : ''}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Actual Amount Paid (€) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-700 text-base">€</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 text-lg font-black font-mono bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-600"
                  />
                </div>
                <p className="text-xs text-slate-600 font-bold mt-1">This amount will be split 50/50 in the shared roommate ledger.</p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Paid By
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['Ozric', 'Pawan'] as Roommate[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setConvertPaidBy(r)}
                      className={`py-2.5 px-3 rounded-xl font-black text-sm border-2 border-slate-900 flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        convertPaidBy === r
                          ? 'bg-emerald-500 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                          : 'bg-slate-50 text-slate-800 hover:bg-slate-100 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                      }`}
                    >
                      <User className="w-4 h-4 stroke-[2.5px]" />
                      <span>{r}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Expense Notes
                </label>
                <input
                  type="text"
                  value={convertNotes}
                  onChange={(e) => setConvertNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold bg-slate-50 border-2 border-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t-2 border-slate-900">
                <button
                  type="button"
                  onClick={() => setConvertingItem(null)}
                  className="px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3px]" />
                  Log Shared Expense & Complete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
