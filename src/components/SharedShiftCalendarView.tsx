import React, { useState, useEffect } from 'react';
import { Roommate, Shift } from '../types';
import { subscribeShifts } from '../dbService';
import { 
  Calendar, 
  Clock, 
  MessageCircle, 
  Briefcase, 
  Sparkles, 
  ShieldCheck, 
  CalendarDays,
  PhoneCall,
  Globe,
  Heart,
  ChevronRight,
  User,
  Info,
  Smartphone
} from 'lucide-react';
import Logo from './Logo';

interface SharedShiftCalendarViewProps {
  targetUser: Roommate;
  onExitSharedView?: () => void;
}

// RELATION CHIPS DEFINITION WITH PERSONALIZED MESSAGES IN NEPALI AND ENGLISH
interface RelationOption {
  id: string;
  labelNe: string;
  labelEn: string;
  icon: string;
  messageNe: (name: string, hostName: string) => string;
  messageEn: (name: string, hostName: string) => string;
}

const RELATION_OPTIONS: RelationOption[] = [
  {
    id: 'mom_dad',
    labelNe: 'आमा / बुबा (Mom / Dad)',
    labelEn: 'Mom / Dad',
    icon: '👨‍👩‍👧',
    messageNe: (name, host) => 
      `आदरणीय आमा तथा बुबा, माल्टाबाट हार्दिक ढोग तथा माया! म यहाँ कुशल छु र कडा मिहिनेत गर्दैछु। तपाईंहरूको माया र आशीर्वादले मलाई सधैं हिम्मत दिन्छ। मेरो ड्युटीको समय हेरेर मलाई फुर्सद भएको बेला ढुक्कले फोन वा म्यासेज गर्नुहोला। आफ्नो स्वास्थ्यको ख्याल राख्नुहोला!`,
    messageEn: (name, host) => 
      `Dearest Mom & Dad, sending you all my love and respect from Malta! I am working hard here for our bright future. Please check my shift schedule to find when I am off work and feel free to call or message me anytime. Take good care of your health!`
  },
  {
    id: 'sibling',
    labelNe: 'दाजु / भाइ / दिदी / बहिनी (Sibling)',
    labelEn: 'Brother / Sister',
    icon: '👦',
    messageNe: (name, host) => 
      `नमस्ते ${name}! कस्तो चल्दैछ? माल्टाबाट तिमीलाई धेरै सम्झना छ। मेरो ड्युटी सकेपछि आरामले गफ हानौँला है। मेरो कामको समय यहाँ हेरेर मलाई ह्वाट्सएपमा म्यासेज वा फोन गर!`,
    messageEn: (name, host) => 
      `Hey ${name}! Missing you so much from Malta. Check my shift schedule here so we can catch up on WhatsApp or call whenever my shift ends!`
  },
  {
    id: 'family',
    labelNe: 'परिवार / नातेदार (Family / Relative)',
    labelEn: 'Family / Relative',
    icon: '🏠',
    messageNe: (name, host) => 
      `नमस्कार! माल्टाबाट तपाईंहरू सबैलाई हार्दिक प्रणाम तथा मीठो सम्झना! म यहाँ कुशल छु। फुर्सदको समयमा कुराकानी गर्न मेरो कामको तालिका यहाँ हेर्न सक्नुहुन्छ।`,
    messageEn: (name, host) => 
      `Warmest greetings from Malta! I am doing well here. Please check my shift schedule to find the best time for us to connect and catch up!`
  },
  {
    id: 'friend',
    labelNe: 'साथी / मित्र (Friend / Bestie)',
    labelEn: 'Friend / Bestie',
    icon: '🤝',
    messageNe: (name, host) => 
      `ए साथी (${name})! कस्तो चल्दैछ? माल्टामा ड्युटी खट्दै छु। मेरो सिफ्ट सकिएपछि गफ हानौँला! मेरो कामको तालिका हेरेर मलाई ह्वाट्सएप हान है!`,
    messageEn: (name, host) => 
      `Hey ${name}! Working hard in Malta! Check out my work shift calendar here so we can catch up on call or WhatsApp after my shift!`
  },
  {
    id: 'partner',
    labelNe: 'माया / जीवनसाथी (Partner)',
    labelEn: 'Partner / Spouse',
    icon: '💖',
    messageNe: (name, host) => 
      `मेरो माया! तिमीलाई धेरै धेरै सम्झना छ। म यहाँ माल्टामा तिम्रो माया मनमा राखेर काम गर्दैछु। मेरो ड्युटी सकिनेबित्तिकै तिमीलाई फोन गर्छु है।`,
    messageEn: (name, host) => 
      `My love! Missing you so much every single day. I'm working hard here in Malta keeping you in my heart. As soon as my shift finishes, I will call you!`
  },
  {
    id: 'colleague',
    labelNe: 'सहकर्मी / काम (Colleague)',
    labelEn: 'Colleague / Manager',
    icon: '💼',
    messageNe: (name, host) => 
      `नमस्कार! यहाँ ${host} को माल्टाको कामको ड्युटी तालिका राखिएको छ। आवश्यक परेमा हेर्न सक्नुहुनेछ।`,
    messageEn: (name, host) => 
      `Hello! Here is ${host}'s active work shift schedule for planning and coordination.`
  }
];

/**
 * Accurate conversion from Malta Time (Europe/Malta) to target Timezone
 */
function convertMaltaTimeToZone(dateStr: string, timeStr: string, targetZone: string): string {
  if (!dateStr || !timeStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);

    const utcBase = new Date(Date.UTC(year, month - 1, day, hour, minute));

    // Get time in Malta to measure UTC offset
    const maltaFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Malta',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });

    const parts = maltaFmt.formatToParts(utcBase);
    const mYear = parseInt(parts.find(p => p.type === 'year')?.value || `${year}`);
    const mMonth = parseInt(parts.find(p => p.type === 'month')?.value || `${month}`);
    const mDay = parseInt(parts.find(p => p.type === 'day')?.value || `${day}`);
    let mHour = parseInt(parts.find(p => p.type === 'hour')?.value || `${hour}`);
    if (mHour === 24) mHour = 0;
    const mMinute = parseInt(parts.find(p => p.type === 'minute')?.value || `${minute}`);

    const maltaAsUtc = new Date(Date.UTC(mYear, mMonth - 1, mDay, mHour, mMinute));
    const maltaOffsetMs = maltaAsUtc.getTime() - utcBase.getTime();

    // Actual UTC timestamp when it is timeStr in Malta
    const actualUtcMs = utcBase.getTime() - maltaOffsetMs;
    const actualDate = new Date(actualUtcMs);

    const targetFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: targetZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    return targetFmt.format(actualDate);
  } catch (e) {
    return timeStr;
  }
}

export const SharedShiftCalendarView: React.FC<SharedShiftCalendarViewProps> = ({
  targetUser,
  onExitSharedView
}) => {
  // Language State: default 'ne' (Nepali)
  const [lang, setLang] = useState<'ne' | 'en'>('ne');

  // Automatic Mobile Device Time Zone
  const deviceTimeZone = typeof Intl !== 'undefined' && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'Asia/Kathmandu';

  // Storage Keys
  const visitorKey = `shared_cal_visitor_${targetUser}`;
  const relationKey = `shared_cal_relation_${targetUser}`;

  const [visitorName, setVisitorName] = useState<string>(() => sessionStorage.getItem(visitorKey) || '');
  const [selectedChipId, setSelectedChipId] = useState<string>(() => sessionStorage.getItem(relationKey) || 'mom_dad');
  const [customRelationInput, setCustomRelationInput] = useState<string>('');
  const [hasAccess, setHasAccess] = useState<boolean>(() => !!sessionStorage.getItem(visitorKey));

  // Shifts state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<'upcoming' | 'all'>('upcoming');

  // User details
  const hostName = targetUser === 'Ozric' ? 'Aneesh' : targetUser;
  const phoneNumber = '+35699765895';
  const rawPhone = '35699765895';

  const isDayOff = (shift: { title?: string; startTime?: string; endTime?: string }) => {
    if (!shift) return false;
    const titleLower = (shift.title || '').trim().toLowerCase();
    if (
      titleLower.includes('day off') ||
      titleLower === 'off' ||
      titleLower === 'dayoff' ||
      titleLower === 'rest day' ||
      titleLower === 'holiday' ||
      titleLower === 'vacation' ||
      titleLower === 'leave'
    ) {
      return true;
    }
    if (shift.startTime && shift.endTime && shift.startTime === shift.endTime) {
      return true;
    }
    return false;
  };

  // Subscribe to real-time shifts
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeShifts(targetUser, (userShifts) => {
      const sorted = [...userShifts].sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.startTime.localeCompare(b.startTime);
      });
      setShifts(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [targetUser]);

  // Verify access & save identity
  const handleVerifyAccess = (e: React.FormEvent) => {
    e.preventDefault();
    const relObj = RELATION_OPTIONS.find(r => r.id === selectedChipId);
    const defaultLabel = lang === 'ne' ? (relObj ? relObj.labelNe : 'साथी') : (relObj ? relObj.labelEn : 'Friend');
    const finalName = customRelationInput.trim() || defaultLabel;

    setVisitorName(finalName);
    sessionStorage.setItem(visitorKey, finalName);
    sessionStorage.setItem(relationKey, selectedChipId);
    setHasAccess(true);
  };

  // Date Helpers
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(dateStr);
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  };

  const getTodayDateStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayDateStr();
  const todayShifts = shifts.filter(s => s.date === todayStr);
  const upcomingShifts = shifts.filter(s => s.date >= todayStr);
  const displayedShifts = filterMode === 'upcoming' ? upcomingShifts : shifts;

  // Calculate shift duration in hours
  const getShiftHours = (start: string, end: string, breakMins: number = 30) => {
    if (!start || !end || start === end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let sMins = sh * 60 + sm;
    let eMins = eh * 60 + em;
    if (eMins < sMins) eMins += 24 * 60;
    return Math.max(0, (eMins - sMins - breakMins) / 60);
  };

  const getShiftIcon = (startTime: string) => {
    if (!startTime) return '☀️';
    const hour = parseInt(startTime.split(':')[0], 10);
    if (hour >= 5 && hour < 12) return '🌅';
    if (hour >= 12 && hour < 18) return '☀️';
    return '🌙';
  };

  // WhatsApp Link
  const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(
    lang === 'ne' 
      ? `नमस्ते ${hostName}! म तपाईंको कामको क्यालेन्डर हेरेर म्यासेज गर्दैछु।`
      : `Hi ${hostName}! Checking in from your shift calendar.`
  )}`;

  // Retrieve current relation option for message
  const activeRelation = RELATION_OPTIONS.find(r => r.id === selectedChipId) || RELATION_OPTIONS[0];
  const personalMessage = lang === 'ne' 
    ? activeRelation.messageNe(visitorName, hostName)
    : activeRelation.messageEn(visitorName, hostName);

  // Friendly time zone display name for visitor
  const isMaltaDevice = deviceTimeZone === 'Europe/Malta';

  // =========================================================================
  // STEP 1: IDENTITY GATE CARD ("Who are you to Aneesh?")
  // =========================================================================
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-3 sm:p-4 font-sans text-slate-900">
        <div className="bg-white border-4 border-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-[10px_10px_0px_0px_rgba(245,158,11,1)] space-y-5 animate-fade-in my-auto">
          
          {/* HEADER & LANGUAGE SWITCHER */}
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
            <Logo size="md" subtext="Family & Friends Portal" />
            
            {/* LANGUAGE TOGGLE BUTTON */}
            <button
              onClick={() => setLang(lang === 'ne' ? 'en' : 'ne')}
              className="px-3 py-1.5 bg-amber-300 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1.5 transition cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{lang === 'ne' ? '🇬🇧 English' : '🇳🇵 नेपाली'}</span>
            </button>
          </div>

          {/* WELCOME HEADING */}
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black font-display text-slate-900 uppercase tracking-tight">
              {lang === 'ne' ? `${hostName} को कामको तालिका (Shifts)` : `${hostName}'s Work Calendar`}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
              {lang === 'ne' 
                ? `नमस्ते! ${hostName} माल्टामा हुनुहुन्छ। उहाँको कामको ड्युटी समय र फुर्सदको समय सजिलै हेर्नको लागि आफ्नो सम्बन्ध रोज्नुहोस्।`
                : `Welcome! ${hostName} is working in Malta. Please select your relationship to view live work shift hours.`
              }
            </p>
          </div>

          {/* FORM */}
          <form onSubmit={handleVerifyAccess} className="space-y-4">
            
            <div className="space-y-2">
              <label className="text-xs font-black uppercase font-mono text-slate-900 tracking-wider block">
                {lang === 'ne' ? `तपाईं ${hostName} को हुनुहुन्छ? (Who are you?)` : `Who are you to ${hostName}?`}
              </label>

              {/* RELATIONSHIP CHIPS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RELATION_OPTIONS.map(chip => {
                  const isSelected = selectedChipId === chip.id && !customRelationInput;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setSelectedChipId(chip.id);
                        setCustomRelationInput('');
                      }}
                      className={`p-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border-2 text-left flex items-center gap-2.5 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] scale-[1.01]'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-900 hover:bg-white'
                      }`}
                    >
                      <span className="text-lg">{chip.icon}</span>
                      <span className="truncate">{lang === 'ne' ? chip.labelNe : chip.labelEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CUSTOM NAME INPUT */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase font-mono text-slate-700 block">
                {lang === 'ne' ? 'वा आफ्नो नाम लेख्नुहोस् (Optional Name)' : 'Or type your name'}
              </label>
              <input
                type="text"
                placeholder={lang === 'ne' ? 'जस्तै: आमा, बुबा, दाइ, साथी...' : 'e.g., Mom, Uncle, Best Friend...'}
                value={customRelationInput}
                onChange={(e) => setCustomRelationInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none"
              />
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{lang === 'ne' ? 'तालिका हेर्नुहोस् (View Schedule)' : `View ${hostName}'s Schedule`}</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </form>

          <div className="pt-1 text-center text-[10px] font-mono text-slate-500 font-bold flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
            <span>{lang === 'ne' ? 'अनीशद्वारा प्रत्यक्ष साझा गरिएको गोप्य लिङ्क' : `Private calendar link shared by ${hostName}`}</span>
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 2: SHARED CALENDAR DASHBOARD WITH AUTOMATIC MOBILE TIME ZONE
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-16">
      
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white border-b-4 border-slate-900 px-3 sm:px-4 py-3 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-400 text-slate-950 rounded-2xl border-2 border-slate-900 flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] shrink-0">
              <CalendarDays className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base font-black font-display uppercase text-white leading-none tracking-wide truncate">
                {lang === 'ne' ? `${hostName} को कामको तालिका` : `${hostName}'s Shift Schedule`}
              </h1>
              <p className="text-[10px] sm:text-[11px] font-mono text-amber-300 font-bold mt-0.5 truncate">
                {lang === 'ne' ? `स्वागत छ, ${visitorName}!` : `Welcome, ${visitorName}!`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* LANGUAGE TOGGLE */}
            <button
              onClick={() => setLang(lang === 'ne' ? 'en' : 'ne')}
              className="px-2.5 py-1 bg-amber-300 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition cursor-pointer flex items-center gap-1"
              title="Change Language"
            >
              <Globe className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="font-mono">{lang === 'ne' ? 'EN' : 'नेपाली'}</span>
            </button>

            {/* WHATSAPP BUTTON */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 sm:px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1 transition cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            {onExitSharedView && (
              <button
                onClick={onExitSharedView}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
              >
                App
              </button>
            )}
          </div>

        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="max-w-2xl mx-auto p-3 sm:p-4 space-y-4 mt-1">

        {/* AUTOMATIC MOBILE TIMEZONE NOTICE BADGE */}
        <div className="bg-amber-50 border-2 border-slate-900 rounded-2xl px-3.5 py-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center justify-between text-xs font-mono font-bold text-slate-800 flex-wrap gap-1">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-700 stroke-[2.5] shrink-0" />
            <span>
              {lang === 'ne' 
                ? `समय स्वचालित रूपमा तपाईंको मोबाइलको टाइमजोन (${deviceTimeZone.split('/')[1] || deviceTimeZone}) अनुसार मिलाइएको छ` 
                : `Shift times automatically set to your mobile device time zone (${deviceTimeZone})`
              }
            </span>
          </div>

          <span className="text-[10px] bg-slate-900 text-amber-300 font-black px-2 py-0.5 rounded border border-slate-900">
            🇲🇹 Malta Work Hours
          </span>
        </div>

        {/* PERSONAL HEART-TOUCHING MESSAGE FOR THIS RELATIONSHIP */}
        <div className="bg-white border-4 border-slate-900 rounded-3xl p-4 sm:p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-2.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-rose-100 text-rose-600 rounded-xl border border-slate-900 flex items-center justify-center font-bold">
                <Heart className="w-4 h-4 fill-rose-500 stroke-[2]" />
              </div>
              <span className="text-xs font-mono font-black uppercase text-slate-900">
                {lang === 'ne' ? `${hostName} को विशेष सन्देश` : `${hostName}'s Special Message for You`}
              </span>
            </div>

            <button
              onClick={() => {
                sessionStorage.removeItem(visitorKey);
                sessionStorage.removeItem(relationKey);
                setHasAccess(false);
              }}
              className="text-[10px] font-mono font-bold text-slate-500 hover:text-slate-900 underline cursor-pointer"
            >
              {lang === 'ne' ? 'सम्बन्ध फेर्नुहोस्' : 'Change relation'}
            </button>
          </div>

          <div className="bg-rose-50 border-2 border-slate-900 rounded-2xl p-3.5 space-y-1 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <p className="text-xs sm:text-sm font-semibold leading-relaxed font-sans italic text-slate-900">
              "{personalMessage}"
            </p>
            <div className="text-right pt-1 text-[11px] font-mono font-black text-rose-800">
              — {hostName} (Malta 🇲🇹)
            </div>
          </div>
        </div>

        {/* DIRECT PHONE & WHATSAPP QUICK CALL CARD */}
        <div className="bg-slate-900 text-white border-4 border-slate-900 rounded-3xl p-4 sm:p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black uppercase bg-emerald-400 text-slate-950 px-2 py-0.5 rounded border border-slate-900">
                {lang === 'ne' ? 'सम्पर्क विवरण (Contact)' : 'Direct Contact'}
              </span>
              <span className="text-xs font-mono font-bold text-amber-300">
                {phoneNumber}
              </span>
            </div>
            <Sparkles className="w-4 h-4 text-amber-400 stroke-[2.5]" />
          </div>

          <p className="text-xs text-slate-300 font-medium">
            {lang === 'ne'
              ? `${hostName} लाई सोझै माल्टाको नम्बरमा फोन वा ह्वाट्सएप म्यासेज गर्न तल थिच्नुहोस्:`
              : `Call or message ${hostName} directly on his Malta number anytime:`
            }
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
            <a
              href={`tel:${phoneNumber}`}
              className="p-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <PhoneCall className="w-4 h-4 stroke-[2.5]" />
              <span>{lang === 'ne' ? 'फोन गर्नुहोस्' : 'Direct Call'}</span>
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4 stroke-[2.5]" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>

        {/* TODAY'S SHIFT STATUS CARD */}
        <div className="bg-white border-4 border-slate-900 rounded-3xl p-4 sm:p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-3">
          
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black uppercase bg-slate-900 text-amber-300 px-2.5 py-1 rounded-xl">
                {lang === 'ne' ? 'आजको कामको अवस्था' : "Today's Status"}
              </span>
              <span className="text-xs font-bold text-slate-600 font-mono">
                {new Date().toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-IE', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>

          {todayShifts.length > 0 ? (
            todayShifts.map((shift, idx) => {
              const hrs = getShiftHours(shift.startTime, shift.endTime, Number(shift.unpaidBreakMinutes ?? 30));
              const shiftIcon = getShiftIcon(shift.startTime);

              // Converted Times to visitor's mobile device time
              const convertedStart = convertMaltaTimeToZone(shift.date, shift.startTime, deviceTimeZone);
              const convertedEnd = convertMaltaTimeToZone(shift.date, shift.endTime, deviceTimeZone);

              return (
                <div key={idx} className="bg-amber-50 border-3 border-slate-900 rounded-2xl p-4 space-y-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-mono font-black uppercase bg-amber-400 text-slate-950 px-2 py-0.5 rounded-lg border border-slate-900 flex items-center gap-1">
                      <span>{shiftIcon}</span>
                      <span>{lang === 'ne' ? 'आज काम छ (Working Today)' : 'Working Today'}</span>
                    </span>

                    <span className="text-xs font-black text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-slate-900">
                      🇲🇹 Malta: {shift.startTime} – {shift.endTime} ({hrs.toFixed(1)} hrs)
                    </span>
                  </div>

                  {/* CONVERTED MOBILE DEVICE TIME */}
                  {!isMaltaDevice && (
                    <div className="bg-emerald-100 border border-slate-900 rounded-xl p-2 text-xs font-bold text-slate-900 flex items-center justify-between font-mono">
                      <span>📱 {lang === 'ne' ? 'तपाईंको फोनको समय:' : 'Your Phone Time:'}</span>
                      <span className="text-emerald-950 font-black text-sm">
                        {convertedStart} – {convertedEnd}
                      </span>
                    </div>
                  )}

                  <h3 className="text-lg font-black text-slate-900 font-display">
                    {shift.title}
                  </h3>

                  {shift.employerName && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 font-mono">
                      <Briefcase className="w-3.5 h-3.5 text-slate-800 stroke-[2.5]" />
                      <span>{shift.employerName}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-amber-200 text-xs font-medium text-amber-950 flex items-center justify-between flex-wrap gap-1">
                    <span className="font-bold">{lang === 'ne' ? '💡 फोन गर्ने उत्तम समय:' : '💡 Recommended call time:'}</span>
                    <strong className="font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-900 font-mono">
                      {lang === 'ne' ? `ड्युटी सकिएपछि (${convertedEnd} पछि)` : `After ${convertedEnd}`}
                    </strong>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-emerald-50 border-3 border-slate-900 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <div className="space-y-1">
                <span className="text-xs font-mono font-black uppercase text-emerald-950 bg-emerald-300 px-2 py-0.5 rounded-lg border border-slate-900 inline-block">
                  🌴 {lang === 'ne' ? 'आज बिदा छ (Day Off)' : 'Day Off Today'}
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {lang === 'ne' ? `${hostName} आज फुर्सदमा हुनुहुन्छ!` : `${hostName} is free all day!`}
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  {lang === 'ne' ? 'आज ढुक्कले फोन वा ह्वाट्सएप म्यासेज गर्न सक्नुहुन्छ।' : 'Great opportunity to call or send a WhatsApp message.'}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-400 text-slate-950 rounded-2xl border-2 border-slate-900 flex items-center justify-center font-black text-2xl shrink-0 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                ☀️
              </div>
            </div>
          )}

        </div>

        {/* UPCOMING SHIFTS SCHEDULE LIST */}
        <div className="bg-white border-4 border-slate-900 rounded-3xl p-4 sm:p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-4">
          
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-black uppercase font-display text-slate-900 tracking-tight">
                {lang === 'ne' ? 'आगामी कामको तालिका' : 'Work Shift Schedule'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {lang === 'ne' ? 'तपाईंको फोनको समय क्षेत्रअनुसार रूपान्तरित' : 'Converted to your mobile device time'}
              </p>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterMode('upcoming')}
                className={`px-2.5 py-1 text-xs font-mono font-black uppercase rounded-xl border-2 cursor-pointer transition ${
                  filterMode === 'upcoming' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]' 
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-900'
                }`}
              >
                {lang === 'ne' ? 'आगामी' : 'Upcoming'} ({upcomingShifts.length})
              </button>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 text-xs font-mono font-black uppercase rounded-xl border-2 cursor-pointer transition ${
                  filterMode === 'all' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]' 
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-900'
                }`}
              >
                {lang === 'ne' ? 'सबै' : 'All'} ({shifts.length})
              </button>
            </div>
          </div>

          {/* LOADING STATE */}
          {loading ? (
            <div className="py-12 text-center text-xs font-mono font-bold text-slate-500 space-y-2">
              <div className="w-8 h-8 border-3 border-slate-900 border-t-amber-400 rounded-full animate-spin mx-auto" />
              <span>{lang === 'ne' ? 'तालिका लोड हुँदैछ...' : 'Loading shift schedule...'}</span>
            </div>
          ) : displayedShifts.length === 0 ? (
            <div className="py-10 text-center space-y-2 text-slate-500">
              <Calendar className="w-8 h-8 mx-auto text-slate-400 stroke-[2]" />
              <p className="text-xs font-mono font-bold">{lang === 'ne' ? 'कुनै ड्युटी तालिका भेटिएन।' : 'No shifts found.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedShifts.map((shift) => {
                const sDate = parseLocalDate(shift.date);
                const dayName = sDate.toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-IE', { weekday: 'short' });
                const dateNum = sDate.getDate();
                const monthName = sDate.toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-IE', { month: 'short' });
                const isToday = shift.date === todayStr;
                const shiftIsOff = isDayOff(shift);

                if (shiftIsOff) {
                  return (
                    <div 
                      key={shift.id}
                      className={`border-2.5 border-slate-900 rounded-2xl p-3.5 sm:p-4 transition-all flex items-center justify-between gap-3 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] ${
                        isToday ? 'bg-emerald-200 border-emerald-900' : 'bg-emerald-50/80 hover:bg-emerald-100/80'
                      }`}
                    >
                      {/* Date Pillar */}
                      <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl border-2 border-slate-900 flex flex-col items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                        <span className="text-[10px] font-mono uppercase font-black text-amber-300 leading-none">
                          {monthName}
                        </span>
                        <span className="text-lg font-black font-display text-white leading-tight">
                          {dateNum}
                        </span>
                        <span className="text-[9px] font-mono text-slate-300 leading-none">
                          {dayName}
                        </span>
                      </div>

                      {/* Shift Details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm">🌴</span>
                          <h4 className="text-sm font-black text-slate-900 truncate">
                            {shift.title || (lang === 'ne' ? 'बिदा छ (Day Off)' : 'Day Off')}
                          </h4>
                          {isToday && (
                            <span className="text-[9px] font-mono font-black uppercase bg-emerald-400 text-slate-950 px-1.5 py-0.5 rounded border border-slate-900">
                              {lang === 'ne' ? 'आज' : 'Today'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 flex-wrap">
                          <span className="bg-emerald-300 text-emerald-950 px-2 py-0.5 rounded-md border border-slate-900 font-black">
                            🌴 {lang === 'ne' ? 'बिदाको दिन (Day Off)' : 'Day Off / Rest Day'}
                          </span>
                          <span className="text-[11px] text-emerald-900 font-bold">
                            {lang === 'ne' ? 'सम्पर्क गर्ने उपयुक्त समय' : 'Free all day to call or chat'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                const hrs = getShiftHours(shift.startTime, shift.endTime, Number(shift.unpaidBreakMinutes ?? 30));
                const shiftIcon = getShiftIcon(shift.startTime);

                // Converted Start / End to visitor's mobile device time
                const convertedStart = convertMaltaTimeToZone(shift.date, shift.startTime, deviceTimeZone);
                const convertedEnd = convertMaltaTimeToZone(shift.date, shift.endTime, deviceTimeZone);

                return (
                  <div 
                    key={shift.id}
                    className={`border-2.5 border-slate-900 rounded-2xl p-3.5 sm:p-4 transition-all flex items-center justify-between gap-3 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] ${
                      isToday ? 'bg-amber-100' : 'bg-slate-50 hover:bg-white'
                    }`}
                  >
                    
                    {/* Date Pillar */}
                    <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl border-2 border-slate-900 flex flex-col items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                      <span className="text-[10px] font-mono uppercase font-black text-amber-300 leading-none">
                        {monthName}
                      </span>
                      <span className="text-lg font-black font-display text-white leading-tight">
                        {dateNum}
                      </span>
                      <span className="text-[9px] font-mono text-slate-300 leading-none">
                        {dayName}
                      </span>
                    </div>

                    {/* Shift Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm">{shiftIcon}</span>
                        <h4 className="text-sm font-black text-slate-900 truncate">
                          {shift.title}
                        </h4>
                        {isToday && (
                          <span className="text-[9px] font-mono font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded border border-slate-900">
                            {lang === 'ne' ? 'आज' : 'Today'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 flex-wrap">
                        {/* Mobile Device Converted Time */}
                        <span className="bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-md border border-slate-900 font-black">
                          <Clock className="w-3 h-3 inline text-emerald-800 stroke-[2.5] mr-1" />
                          {convertedStart} – {convertedEnd}
                        </span>

                        {/* Malta Time Reference if visitor is outside Malta */}
                        {!isMaltaDevice && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            (🇲🇹 Malta: {shift.startTime} – {shift.endTime})
                          </span>
                        )}

                        {hrs > 0 && (
                          <span className="text-slate-500 font-medium">
                            ({hrs.toFixed(1)}h)
                          </span>
                        )}
                      </div>

                      {shift.employerName && (
                        <p className="text-[11px] font-bold text-slate-600 font-mono truncate">
                          🏢 {shift.employerName}
                        </p>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* BOTTOM FRIENDLY BANNER */}
        <div className="bg-emerald-400 border-4 border-slate-900 rounded-3xl p-4 sm:p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-950">
          <div className="space-y-0.5 text-center sm:text-left">
            <h3 className="text-sm font-black font-display uppercase tracking-tight">
              {lang === 'ne' ? `${hostName} सँग सम्पर्कमा रहनुहोस्` : `Stay connected with ${hostName}`}
            </h3>
            <p className="text-xs font-extrabold text-slate-900 font-mono">
              WhatsApp / Call: {phoneNumber}
            </p>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            <MessageCircle className="w-4 h-4 stroke-[2.5] text-emerald-400" />
            <span>{lang === 'ne' ? 'ह्वाट्सएप खोल्नुहोस्' : 'Open WhatsApp Chat'}</span>
          </a>
        </div>

      </main>

    </div>
  );
};

export default SharedShiftCalendarView;
