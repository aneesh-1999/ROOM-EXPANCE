import React, { useState } from 'react';
import { Roommate } from '../types';
import { 
  Share2, 
  Copy, 
  Check, 
  X, 
  MessageCircle, 
  ExternalLink, 
  ShieldCheck, 
  Users, 
  PhoneCall,
  Globe,
  Smartphone
} from 'lucide-react';

interface ShareCalendarModalProps {
  currentUser: Roommate;
  userNickname?: string;
  onClose: () => void;
}

export const ShareCalendarModal: React.FC<ShareCalendarModalProps> = ({
  currentUser,
  userNickname,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  const displayName = userNickname || (currentUser === 'Ozric' ? 'Aneesh' : currentUser);
  const phoneNumber = '+35699765895';
  
  // Construct the absolute shareable URL
  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = `${baseUrl}?sharedShifts=${encodeURIComponent(currentUser)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${displayName}'s Work Shift Calendar (नेपाली / English)`,
          text: `Check out ${displayName}'s live work shift schedule in Malta (auto-converted to your mobile device time) to see when they are free to talk!`,
          url: shareUrl
        });
      } catch (err) {
        console.log('Native share dismissed or failed', err);
      }
    } else {
      handleCopyLink();
    }
  };

  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `नमस्ते! यहाँ मेरो माल्टाको कामको तालिका (Shift Calendar) छ। तपाईंको मोबाइलको समयअनुसार कामको समय देखिनेछ: ${shareUrl}`
  )}`;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans animate-fade-in">
      
      <div className="bg-white border-4 border-slate-900 rounded-3xl max-w-md w-full shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto flex flex-col text-slate-900 relative">
        
        {/* HEADER */}
        <div className="bg-indigo-600 p-4 sm:p-5 border-b-3 border-slate-900 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white text-indigo-600 rounded-2xl border-2 border-slate-900 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] shrink-0">
              <Share2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-display uppercase tracking-tight leading-none text-white">
                Share Shift Calendar
              </h2>
              <p className="text-[11px] font-bold text-indigo-100 opacity-90 mt-0.5">
                Default Nepali • Auto Mobile Device Time Zone
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-white text-slate-900 border-2 border-slate-900 rounded-xl hover:bg-slate-100 active:translate-y-0.5 transition cursor-pointer shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]"
            title="Close"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* MODAL CONTENT */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Features highlight banner */}
          <div className="bg-amber-50 border-2 border-slate-900 rounded-2xl p-3.5 space-y-1.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-900 font-mono">
              <Smartphone className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
              <span>Nepali Default + Auto Device Time</span>
            </div>
            <p className="text-xs font-medium text-slate-700 leading-snug">
              Family members in Nepal, Australia, or anywhere else will automatically see your Malta shift hours converted directly to their phone's local time in Nepali!
            </p>
          </div>

          {/* SHARE LINK BOX */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase font-mono text-slate-800 tracking-wider block">
              Your Personal Calendar Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3.5 py-2.5 bg-slate-100 border-2 border-slate-900 rounded-xl text-xs font-mono font-bold text-slate-800 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2.5 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 stroke-[2.5]" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ACTION BUTTONS GRID */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            
            {/* WhatsApp Share */}
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl border-2 border-slate-900 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition cursor-pointer flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4 stroke-[2.5]" />
              <span>WhatsApp Share</span>
            </a>

            {/* Native Share / Copy */}
            <button
              onClick={handleNativeShare}
              className="p-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl border-2 border-slate-900 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4 stroke-[2.5]" />
              <span>Share Link</span>
            </button>

          </div>

          {/* Contact phone connected note */}
          <div className="flex items-center justify-between p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-700">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              <span>Direct Number:</span>
            </div>
            <span className="text-slate-900 font-black">{phoneNumber}</span>
          </div>

          {/* PREVIEW LINK BUTTON */}
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <span>Preview How Family Sees It</span>
            <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
          </a>

        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t-2 border-slate-900 flex items-center justify-between text-xs font-mono font-bold text-slate-600">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-slate-700 stroke-[2.5]" />
            <span>Family & Friends Portal</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-900 hover:underline cursor-pointer uppercase font-black"
          >
            Done
          </button>
        </div>

      </div>

    </div>
  );
};

export default ShareCalendarModal;
