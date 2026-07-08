import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface CustomConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export default function CustomConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false
}: CustomConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border-4 border-slate-900 rounded-3xl w-full max-w-md shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto flex flex-col transform transition-all duration-300">
        
        {/* Header */}
        <div className={`p-4 border-b-4 border-slate-900 flex items-center justify-between ${
          isDestructive ? 'bg-rose-100 text-rose-900' : 'bg-indigo-100 text-indigo-900'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 shrink-0 ${isDestructive ? 'text-rose-600' : 'text-indigo-600'}`} />
            <h4 className="font-black uppercase tracking-tight text-xs sm:text-sm">{title}</h4>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-black/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs sm:text-sm font-semibold text-slate-700 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t-2 border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border-2 border-slate-900 bg-white text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-100 active:translate-y-[1px] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition duration-150 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 border-2 border-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider active:translate-y-[1px] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition duration-150 cursor-pointer ${
              isDestructive 
                ? 'bg-rose-600 hover:bg-rose-700' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>

      </div>
    </div>
  );
}
