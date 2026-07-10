import React, { useState, useRef } from 'react';
import { Roommate, Category, SplitType } from '../types';
import { addExpense } from '../dbService';
import { 
  X, 
  Camera, 
  Upload, 
  Sparkles, 
  Euro, 
  Check, 
  ArrowRight, 
  FileText, 
  RefreshCw, 
  HelpCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Key
} from 'lucide-react';

interface ReceiptScannerProps {
  currentUser: Roommate;
  onClose: () => void;
  onSuccess: () => void;
  nicknames: Record<Roommate, string>;
}

// Map store/merchant names to category
const getCategoryForStore = (storeName: string): Category => {
  const store = storeName.toLowerCase();
  if (
    store.includes('lidl') || 
    store.includes('aldi') || 
    store.includes('tesco') || 
    store.includes('spar') || 
    store.includes('rewe') || 
    store.includes('supermarket') || 
    store.includes('grocery') || 
    store.includes('groceries') ||
    store.includes('market') ||
    store.includes('carrefour') ||
    store.includes('sainsbury')
  ) {
    return 'Shared Groceries';
  }
  if (
    store.includes('electricity') || 
    store.includes('power') || 
    store.includes('gas') || 
    store.includes('energy') || 
    store.includes('utility')
  ) {
    return 'Electricity (Coins)';
  }
  if (
    store.includes('rent') || 
    store.includes('landlord') || 
    store.includes('landlady') || 
    store.includes('housing')
  ) {
    return 'Rent';
  }
  if (
    store.includes('internet') || 
    store.includes('wifi') || 
    store.includes('wi-fi') || 
    store.includes('telecom') || 
    store.includes('router') || 
    store.includes('broadband')
  ) {
    return 'Internet/Wi-Fi';
  }
  if (
    store.includes('deliveroo') || 
    store.includes('ubereats') || 
    store.includes('uber eats') || 
    store.includes('takeout') || 
    store.includes('delivery') || 
    store.includes('pizza') || 
    store.includes('restaurant') || 
    store.includes('burger') || 
    store.includes('kebab') || 
    store.includes('cafe') || 
    store.includes('coffee')
  ) {
    return 'Takeout/Delivery';
  }
  if (
    store.includes('dm') || 
    store.includes('rossmann') || 
    store.includes('drugstore') || 
    store.includes('cleaning') || 
    store.includes('supplies') || 
    store.includes('soap') || 
    store.includes('tissue') || 
    store.includes('ikea') || 
    store.includes('action')
  ) {
    return 'Household Supplies';
  }
  return 'Other';
};

// Preset high-quality mock data for testing
const MOCK_RECEIPTS = [
  {
    id: 'lidl',
    label: '🛒 Lidl Malta Grocery Receipt',
    store: 'Lidl Malta Limited',
    total: 21.32,
    date: '2026-07-03',
    vat: 0.43,
    items: [
      { name: 'Cream Ice Cream', price: 2.75 },
      { name: 'Chicken Quarters', price: 8.99 },
      { name: 'Mushrooms', price: 1.95 },
      { name: 'Aquani Still Water x2', price: 1.98 },
      { name: 'Red Onions 1kg', price: 1.09 },
      { name: 'Ginger', price: 1.07 },
      { name: 'New Potatoes 4kg', price: 3.49 }
    ]
  },
  {
    id: 'pizza',
    label: '🍕 Deliveroo Pizza Night',
    store: 'Bella Italia Restaurant',
    total: 38.50,
    date: '2026-07-08',
    vat: 3.50,
    items: [
      { name: 'Stonebaked Pizza Margherita', price: 14.50 },
      { name: 'Pizza Diavola Spicy Pepperoni', price: 16.50 },
      { name: 'Garlic Dough Balls with Dip', price: 5.50 },
      { name: 'Coca-Cola Zero Sugar 330ml x2', price: 2.00 }
    ]
  },
  {
    id: 'wifi',
    label: '🌐 Vodafone Wi-Fi Bill',
    store: 'Vodafone Ireland',
    total: 45.00,
    date: '2026-07-01',
    vat: 8.41,
    items: [
      { name: 'Gigabit Broadband Monthly Charge', price: 45.00 }
    ]
  }
];

// Helper to resize and compress image to keep payload small and fast for OCR
const resizeImage = (file: File, maxW = 1024, maxH = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxW) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          }
        } else {
          if (height > maxH) {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as jpeg at 80% quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export default function ReceiptScanner({ currentUser, onClose, onSuccess, nicknames }: ReceiptScannerProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [selectedSplit, setSelectedSplit] = useState<'50_50' | 'custom' | 'only_me'>('50_50');
  
  // Custom shares
  const [customOzric, setCustomOzric] = useState<number>(0);
  const [customPawan, setCustomPawan] = useState<number>(0);

  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showItems, setShowItems] = useState(true);

  // Client-side direct API fallback if running on static host (e.g. Netlify/GitHub Pages)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('user_gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger camera or file upload
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Helper to call Gemini REST API directly from browser
  const scanReceiptClientSide = async (base64Data: string, keyToUse: string) => {
    const base64Clean = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keyToUse}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Clean
                }
              },
              {
                text: "Analyze this receipt or bill image. Extract the store or merchant name, the date of purchase (or transaction), the total amount, any individual line items with their names/descriptions and prices, and the VAT amount if listed."
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              store: { "type": "STRING", "description": "The name of the store or merchant." },
              date: { "type": "STRING", "description": "Date of the transaction in YYYY-MM-DD format." },
              total: { "type": "NUMBER", "description": "The total transaction amount in EUR." },
              vat: { "type": "NUMBER", "description": "The VAT or Tax amount in EUR if explicitly listed." },
              items: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { "type": "STRING" },
                    price: { "type": "NUMBER" }
                  },
                  required: ["name", "price"]
                }
              }
            },
            required: ["store", "total"]
          }
        }
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const message = errorJson.error?.message || `HTTP error ${response.status}`;
      throw new Error(`Direct Gemini API Error: ${message}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini API did not return any parseable content. Ensure your API Key is valid and active.');
    }

    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch (e) {
      throw new Error('Failed to parse Gemini response as JSON: ' + text);
    }
  };

  // Convert uploaded file to base64 and send to OCR API
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setIsScanning(true);
    setScanResult(null);

    // Create a local image preview
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);

    try {
      // Compress and resize to max 1024px before uploading
      const base64Data = await resizeImage(file, 1024, 1024);

      let data;
      if (apiKey) {
        // Direct browser OCR using user's own key
        data = await scanReceiptClientSide(base64Data, apiKey);
      } else {
        // Express backend proxy call
        const response = await fetch('/api/ocr-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Data,
            mimeType: 'image/jpeg'
          })
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          const htmlText = await response.text();
          if (htmlText.trim().startsWith('<!DOCTYPE') || htmlText.includes('<html')) {
            throw new Error('Static host detected (e.g. Netlify/GitHub Pages) with no active backend server. The backend API is required for real-time OCR scanning. Please provide your own Gemini API Key below to run OCR directly in your browser, or use our high-fidelity Simulator options.');
          }
        }

        if (!response.ok) {
          let errMsg = 'Server returned an error status.';
          try {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
          } catch (e) {
            // Response body is not JSON
          }
          throw new Error(errMsg);
        }

        data = await response.json();
      }

      handleScanSuccess(data);
    } catch (err: any) {
      console.error('OCR scanning error:', err);
      
      let userFriendlyMsg = err.message || err;
      if (userFriendlyMsg.includes('Failed to fetch') || userFriendlyMsg.includes('fetch')) {
        userFriendlyMsg = 'Could not connect to the backend server. The backend server might be starting up, or you are running a static-only export (like on Netlify or GitHub Pages) without the Node.js backend. Provide your own Gemini API Key below to scan directly from your browser, or use the Simulator options below for instant zero-setup testing!';
      } else if (userFriendlyMsg.includes('Static host detected')) {
        userFriendlyMsg = 'Static Host detected (e.g. Netlify). Since static sites do not support dynamic Node.js backend servers, real-time receipt scanning requires your own API key. Provide your own Gemini API Key below to run OCR directly in your browser, or use the high-fidelity Simulator options below for instant zero-setup testing!';
      }
      
      setErrorMsg('Receipt scanning failed: ' + userFriendlyMsg);
      setIsScanning(false);
    }
  };

  // Handle successful scan from backend or mock simulator
  const handleScanSuccess = (data: any) => {
    setScanResult(data);
    setIsScanning(false);
    
    // Set default custom shares
    const half = parseFloat((data.total / 2).toFixed(2));
    setCustomOzric(currentUser === 'Ozric' ? half : parseFloat((data.total - half).toFixed(2)));
    setCustomPawan(currentUser === 'Pawan' ? half : parseFloat((data.total - half).toFixed(2)));
    setSelectedSplit('50_50');
  };

  // Run mock simulator
  const runMockSimulator = (presetId: string) => {
    setErrorMsg('');
    setIsScanning(true);
    setScanResult(null);
    setImagePreview(null);

    const preset = MOCK_RECEIPTS.find(r => r.id === presetId);
    if (!preset) return;

    // Simulate artificial API loading delay
    setTimeout(() => {
      handleScanSuccess({
        store: preset.store,
        date: preset.date,
        total: preset.total,
        vat: preset.vat,
        items: preset.items
      });
    }, 1500);
  };

  // Tweak custom shares
  const adjustShare = (roomie: Roommate, change: number) => {
    if (!scanResult) return;
    const total = scanResult.total;
    
    if (roomie === 'Ozric') {
      const newOzric = Math.max(0, Math.min(total, parseFloat((customOzric + change).toFixed(2))));
      setCustomOzric(newOzric);
      setCustomPawan(parseFloat((total - newOzric).toFixed(2)));
    } else {
      const newPawan = Math.max(0, Math.min(total, parseFloat((customPawan + change).toFixed(2))));
      setCustomPawan(newPawan);
      setCustomOzric(parseFloat((total - newPawan).toFixed(2)));
    }
  };

  // Handle saving the scanned expense to Firebase DB
  const handleSaveExpense = async () => {
    if (!scanResult) return;
    setIsSaving(true);
    setErrorMsg('');

    const total = scanResult.total;
    const store = scanResult.store || 'Unknown Store';
    const dateStr = scanResult.date || new Date().toISOString().split('T')[0];

    let ozricShare = 0;
    let pawanShare = 0;
    let splitType: SplitType = '50/50';

    if (selectedSplit === '50_50') {
      ozricShare = total / 2;
      pawanShare = total / 2;
      splitType = '50/50';
    } else if (selectedSplit === 'only_me') {
      if (currentUser === 'Ozric') {
        ozricShare = total;
        pawanShare = 0;
      } else {
        pawanShare = total;
        ozricShare = 0;
      }
      splitType = 'custom';
    } else {
      // Custom split
      ozricShare = customOzric;
      pawanShare = customPawan;
      splitType = 'custom';
    }

    const category = getCategoryForStore(store);

    // Build line items notes
    let notes = `Scanned via Gemini OCR.\nMerchant: ${store}\nDate: ${dateStr}`;
    if (scanResult.vat) {
      notes += `\nVAT/Tax: €${scanResult.vat.toFixed(2)}`;
    }
    if (scanResult.items && scanResult.items.length > 0) {
      notes += '\n\nItems Extracted:\n' + scanResult.items.map((it: any) => `- ${it.name}: €${it.price.toFixed(2)}`).join('\n');
    }

    try {
      await addExpense({
        title: `${store} Receipt`,
        amount: total,
        paidBy: currentUser, // Scanned by the active roommate who paid
        category,
        splitType,
        notes: notes.trim(),
        splitDetails: {
          OzricAmount: parseFloat(ozricShare.toFixed(2)),
          PawanAmount: parseFloat(pawanShare.toFixed(2))
        },
        createdBy: currentUser,
        status: 'pending' // Enforces standard roommates rules - needs approval of other roommate
      });

      onSuccess();
    } catch (err: any) {
      console.error('Error saving scanned expense:', err);
      setErrorMsg('Failed to save to database: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border-4 border-slate-900 rounded-3xl w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* HEADER */}
        <div className="p-5 border-b-4 border-slate-100 flex items-center justify-between bg-amber-50/30 sticky top-0 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-amber-100 text-amber-600 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <Camera className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">AI Receipt Scanner</h3>
              <p className="text-xs text-slate-500 font-medium">No typing — snap or upload, then save</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-900 transition duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTAINER */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="bg-rose-100 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
              <span className="mt-0.5">⚠️</span>
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* INITIAL SCREEN: UPLOAD OR CAMERA CAPTURE */}
          {!scanResult && !isScanning && (
            <div className="space-y-6">
              {/* UPLOAD PANEL */}
              <div 
                onClick={handleUploadClick}
                className="border-4 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 p-8 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition duration-300 text-center"
              >
                <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Take Photo or Upload Bill</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Supports camera capture on mobile, or PNG/JPEG uploads</p>
                </div>
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
              </div>

              {/* SIMULATOR QUICK PRESETS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h5 className="text-[11px] font-black uppercase text-slate-500 tracking-wider font-mono">
                    Test Scanner with Mock Presets
                  </h5>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {MOCK_RECEIPTS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => runMockSimulator(preset.id)}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-slate-900 hover:bg-slate-50 transition duration-200 text-left shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-900">{preset.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-black bg-slate-100 border border-slate-900 px-2 py-0.5 rounded-lg text-slate-900">
                          €{preset.total.toFixed(2)}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* CUSTOM API KEY FOR STATIC HOSTS */}
              <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-4 space-y-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-650" />
                    <div>
                      <h5 className="text-xs font-black text-slate-900">Custom Gemini API Key</h5>
                      <p className="text-[10px] text-slate-500 font-medium">For static hosts (Netlify / GitHub Pages)</p>
                    </div>
                  </div>
                  {apiKey ? (
                    <span className="text-[9px] font-black uppercase bg-emerald-100 border border-emerald-900 px-2.5 py-0.5 rounded-lg text-emerald-800">
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase bg-amber-100 border border-amber-900 px-2.5 py-0.5 rounded-lg text-amber-800">
                      Not Configured
                    </span>
                  )}
                </div>

                {!showKeyInput ? (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 font-bold text-[10px] font-mono">
                      {apiKey ? `••••••••${apiKey.slice(-4)}` : 'Using standard server API proxy'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTempKey(apiKey);
                        setShowKeyInput(true);
                      }}
                      className="text-[10px] font-black text-indigo-650 hover:text-indigo-850 underline uppercase tracking-wider cursor-pointer"
                    >
                      {apiKey ? 'Edit Key' : 'Configure Key'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                      Enter a Google Gemini API Key. It is stored <strong>only</strong> in your local browser cache (`localStorage`) and never shared or sent to any server.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={tempKey}
                        onChange={(e) => setTempKey(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs font-mono rounded-xl bg-white border-2 border-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = tempKey.trim();
                          localStorage.setItem('user_gemini_api_key', trimmed);
                          setApiKey(trimmed);
                          setShowKeyInput(false);
                          setErrorMsg('');
                        }}
                        className="px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-slate-900 text-white rounded-xl border-2 border-slate-900 cursor-pointer hover:bg-slate-800"
                      >
                        Save
                      </button>
                      {apiKey && (
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.removeItem('user_gemini_api_key');
                            setApiKey('');
                            setTempKey('');
                            setShowKeyInput(false);
                            setErrorMsg('');
                          }}
                          className="px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 rounded-xl border-2 border-rose-900 cursor-pointer hover:bg-rose-100"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCANNING ACTIVE INDICATOR */}
          {isScanning && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative w-24 h-32 bg-slate-50 border-4 border-slate-900 rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                {/* Simulated Red Laser Scan Line */}
                <div className="absolute left-0 right-0 h-1.5 bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.7)] animate-[bounce_2s_infinite]"></div>
                <div className="w-full h-full flex flex-col justify-around p-3 opacity-30">
                  <div className="h-2 bg-slate-400 rounded w-3/4"></div>
                  <div className="h-2 bg-slate-400 rounded w-1/2"></div>
                  <div className="h-2 bg-slate-400 rounded w-5/6"></div>
                  <div className="h-2 bg-slate-400 rounded w-2/3"></div>
                </div>
              </div>
              <div className="space-y-1.5 max-w-xs">
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <h4 className="text-sm font-black text-slate-900">Gemini Parsing Receipt...</h4>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Extracting Store, Date, VAT, Total & Itemized list. Thank you for waiting!
                </p>
              </div>
            </div>
          )}

          {/* OCR RESULTS SCREEN */}
          {scanResult && !isScanning && (
            <div className="space-y-5">
              {/* BRAND / STORE CARD */}
              <div className="bg-indigo-50/50 border-3 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-indigo-600 tracking-wider font-mono">Detected Store</h4>
                  <p className="text-base font-black text-slate-900 mt-0.5">{scanResult.store}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Date: {scanResult.date || 'Today'}</p>
                </div>
                <div className="text-right">
                  <h4 className="text-xs font-black uppercase text-emerald-600 tracking-wider font-mono">Total Amount</h4>
                  <p className="text-xl font-black text-emerald-700 font-mono mt-0.5">€{scanResult.total.toFixed(2)}</p>
                  {scanResult.vat && (
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">Incl. VAT: €{scanResult.vat.toFixed(2)}</p>
                  )}
                </div>
              </div>

              {/* ITEMS ACCORDION */}
              {scanResult.items && scanResult.items.length > 0 && (
                <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setShowItems(!showItems)}
                    className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border-b-2 border-slate-900 flex items-center justify-between text-xs font-black text-slate-700 font-mono cursor-pointer"
                  >
                    <span>EXTRACTED ITEMS ({scanResult.items.length})</span>
                    {showItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showItems && (
                    <div className="divide-y divide-slate-200 max-h-48 overflow-y-auto p-2 bg-white space-y-1">
                      {scanResult.items.map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] py-1 px-2 font-medium text-slate-600">
                          <span className="truncate max-w-[70%]">{it.name}</span>
                          <span className="font-mono font-bold text-slate-900">€{it.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* DETECTED CATEGORY */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                <span>Categorized as:</span>
                <span className="bg-amber-100 border border-slate-900 px-2.5 py-1 rounded-full text-amber-950 font-black text-[10px] uppercase font-mono shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                  {getCategoryForStore(scanResult.store)}
                </span>
              </div>

              {/* THE CRUCIAL SPLIT SELECTOR */}
              <div className="space-y-3.5 border-t-3 border-slate-100 pt-4">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider font-mono">
                    Split Bill?
                  </h4>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSplit('50_50')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                      selectedSplit === '50_50'
                        ? 'bg-emerald-100 border-slate-900 text-slate-900 font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                        : 'bg-white border-slate-300 text-slate-500 font-bold hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[11px] font-black">✅ 50/50</span>
                    <span className="text-[9px] font-mono opacity-80 leading-none">
                      €{(scanResult.total / 2).toFixed(2)} each
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSplit('custom')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                      selectedSplit === 'custom'
                        ? 'bg-indigo-100 border-slate-900 text-slate-900 font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                        : 'bg-white border-slate-300 text-slate-500 font-bold hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[11px] font-black">✏️ Custom</span>
                    <span className="text-[9px] font-mono opacity-80 leading-none">
                      Adjust shares
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSplit('only_me')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                      selectedSplit === 'only_me'
                        ? 'bg-rose-100 border-slate-900 text-slate-900 font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                        : 'bg-white border-slate-300 text-slate-500 font-bold hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[11px] font-black font-sans">👤 Only me</span>
                    <span className="text-[9px] font-mono opacity-80 leading-none">
                      100% my cost
                    </span>
                  </button>
                </div>

                {/* CUSTOM SPLIT ADJUSTMENT BUTTONS (NO TYPING REQUIRED) */}
                {selectedSplit === 'custom' && (
                  <div className="bg-slate-50 border-2 border-slate-900 p-3.5 rounded-2xl space-y-3.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-500 font-mono">Roommate</span>
                      <span className="text-[10px] font-black uppercase text-slate-500 font-mono">Adjust Share</span>
                    </div>

                    {/* Ozric adjustment */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-bold text-slate-800">{nicknames.Ozric}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustShare('Ozric', -1.0)}
                          className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-900 text-slate-900 rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center cursor-pointer"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustShare('Ozric', -0.1)}
                          className="w-8 h-7 bg-white hover:bg-slate-100 border border-slate-900 text-slate-900 rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center cursor-pointer"
                        >
                          -.1
                        </button>
                        <span className="w-16 text-center font-mono font-black text-xs text-slate-950">
                          €{customOzric.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustShare('Ozric', 0.1)}
                          className="w-8 h-7 bg-white hover:bg-slate-100 border border-slate-900 text-slate-900 rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center cursor-pointer"
                        >
                          +.1
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustShare('Ozric', 1.0)}
                          className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-900 text-slate-900 rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center cursor-pointer"
                        >
                          +1
                        </button>
                      </div>
                    </div>

                    {/* Pawan adjustment */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-bold text-slate-800">{nicknames.Pawan}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustShare('Pawan', -1.0)}
                          className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-900 text-slate-900 rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center cursor-pointer"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustShare('Pawan', -0.1)}
                          className="w-8 h-7 bg-white hover:bg-slate-100 border border-slate-900 text-slate-900 rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center cursor-pointer"
                        >
                          -.1
                        </button>
                        <span className="w-16 text-center font-mono font-black text-xs text-slate-950">
                          €{customPawan.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustShare('Pawan', 0.1)}
                          className="w-8 h-7 bg-white hover:bg-slate-100 border border-slate-900 text-slate-900 rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center cursor-pointer"
                        >
                          +.1
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustShare('Pawan', 1.0)}
                          className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-900 text-slate-900 rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center cursor-pointer"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM CONFIRMATION BUTTONS */}
        {scanResult && !isScanning && (
          <div className="p-5 border-t-4 border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setScanResult(null);
                setImagePreview(null);
              }}
              className="px-4 py-3 bg-white hover:bg-slate-150 text-slate-700 border-2 border-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] cursor-pointer"
            >
              Scan New
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveExpense}
              className="flex-1 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save & Log Bill
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
