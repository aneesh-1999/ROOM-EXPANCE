import React, { useState, useEffect } from 'react';
import { Roommate } from '../types';
import { 
  generateDailyMotivation, 
  saveUserFeeling, 
  markDailyQuoteShown, 
  COMMON_FEELINGS, 
  DailyMotivationResponse
} from '../aiMotivationService';
import { 
  Quote, 
  RefreshCw, 
  Check, 
  X, 
  Sun,
  Sparkles
} from 'lucide-react';

interface DailyMotivationModalProps {
  currentUser: Roommate;
  onClose: () => void;
}

export const DailyMotivationModal: React.FC<DailyMotivationModalProps> = ({
  currentUser,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [motivation, setMotivation] = useState<DailyMotivationResponse | null>(null);
  const [selectedFeeling, setSelectedFeeling] = useState<string>('hopeful');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load daily quote
  const loadMotivationData = async () => {
    setLoading(true);
    try {
      const res = await generateDailyMotivation(currentUser);
      setMotivation(res);
    } catch (err) {
      console.error('Error loading quote', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMotivationData();
  }, [currentUser]);

  // Save selected feeling and dismiss modal
  const handleSaveAndClose = () => {
    const feelingObj = COMMON_FEELINGS.find(f => f.id === selectedFeeling);
    const feelingLabel = feelingObj ? feelingObj.label : selectedFeeling;

    saveUserFeeling(currentUser, feelingLabel);
    markDailyQuoteShown(currentUser);

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-fade-in">
      
      {/* ULTRA-CLEAN NON-CLUTTERED CARD */}
      <div className="bg-white border-3 border-slate-900 rounded-3xl max-w-md w-full shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto flex flex-col relative text-slate-900">
        
        {/* SIMPLE HEADER */}
        <div className="bg-amber-100 p-4 border-b-2 border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-amber-400 text-slate-950 rounded-lg border-1.5 border-slate-900 flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
              <Sun className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-xs font-black uppercase font-mono tracking-wider text-slate-900">
              Daily Inspiration
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* QUOTE CONTENT & FEELING SELECTOR */}
        <div className="p-5 space-y-5">

          {/* QUOTE AREA */}
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Sparkles className="w-6 h-6 animate-spin text-amber-500 stroke-[2]" />
              <span className="text-xs font-mono font-bold">Loading quote...</span>
            </div>
          ) : (
            motivation && (
              <div className="space-y-3">
                <div className="relative">
                  <Quote className="w-5 h-5 text-amber-500 mb-1 stroke-[2.5]" />
                  <p className="text-base sm:text-lg font-serif font-extrabold italic text-slate-900 leading-snug">
                    "{motivation.quote}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-mono">
                  <span className="font-bold text-amber-800">
                    — {motivation.author}
                  </span>
                  <button
                    onClick={loadMotivationData}
                    className="p-1 text-slate-400 hover:text-slate-900 transition cursor-pointer"
                    title="New quote"
                  >
                    <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            )
          )}

          {/* FEELINGS SELECTOR */}
          <div className="pt-3 border-t-2 border-slate-100 space-y-2">
            <label className="text-[11px] font-black uppercase font-mono text-slate-700 tracking-wider block">
              How are you feeling today?
            </label>

            <div className="flex flex-wrap gap-1.5">
              {COMMON_FEELINGS.map(f => {
                const isSelected = selectedFeeling === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFeeling(f.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-2 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-900 hover:bg-white'
                    }`}
                  >
                    <span>{f.icon}</span>
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* BOTTOM ACTION BUTTON */}
        <div className="p-4 bg-slate-50 border-t-2 border-slate-900 flex justify-end">
          <button
            onClick={handleSaveAndClose}
            className="w-full sm:w-auto px-5 py-2 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Saved</span>
              </>
            ) : (
              <span>Done</span>
            )}
          </button>
        </div>

      </div>

    </div>
  );
};

export default DailyMotivationModal;
