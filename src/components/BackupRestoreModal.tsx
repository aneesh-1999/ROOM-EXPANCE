import React, { useState } from 'react';
import { 
  downloadBackupFile, 
  validateBackupJSON, 
  restoreBackupData, 
  BackupPackage 
} from '../backupService';
import { 
  X, 
  Download, 
  Upload, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  ShieldCheck, 
  ArrowRight,
  HardDrive
} from 'lucide-react';

interface BackupRestoreModalProps {
  onClose: () => void;
  onRestoreComplete?: () => void;
}

export default function BackupRestoreModal({ onClose, onRestoreComplete }: BackupRestoreModalProps) {
  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<{ fileName: string; itemCount: number } | null>(null);
  const [downloadError, setDownloadError] = useState('');

  // Restore state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupPackage, setBackupPackage] = useState<BackupPackage | null>(null);
  const [validationSummary, setValidationSummary] = useState('');
  const [validationError, setValidationError] = useState('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');

  // Execution state
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStatusMsg, setRestoreStatusMsg] = useState('');
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);

  // Handle Download Backup
  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError('');
    setDownloadSuccess(null);
    try {
      const res = await downloadBackupFile();
      setDownloadSuccess(res);
    } catch (err: any) {
      console.error('[BackupRestoreModal] Error generating download:', err);
      setDownloadError('Failed to generate backup file: ' + (err.message || String(err)));
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle File Upload Select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setValidationError('');
    setValidationSummary('');
    setBackupPackage(null);
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const val = validateBackupJSON(content);
      if (!val.isValid || !val.backupPackage) {
        setValidationError(val.error || 'Invalid backup file format.');
      } else {
        setBackupPackage(val.backupPackage);
        setValidationSummary(val.summaryText || 'Backup file verified successfully.');
      }
    };
    reader.onerror = () => {
      setValidationError('Failed to read selected file.');
    };
    reader.readAsText(file);
  };

  // Handle Restore Action
  const handleRestore = async () => {
    if (!backupPackage) return;

    if (restoreMode === 'overwrite') {
      const confirmed = window.confirm(
        '⚠️ WARNING: OVERWRITE MODE SELECTED!\n\nThis will ERASE all current database entries before restoring the backup contents.\n\nAre you sure you want to proceed with FULL OVERWRITE?'
      );
      if (!confirmed) return;
    }

    setIsRestoring(true);
    setRestoreProgress(0);
    setRestoreStatusMsg('Initializing backup restoration process...');
    setRestoreResult(null);

    try {
      const res = await restoreBackupData(
        backupPackage, 
        restoreMode, 
        (msg, percent) => {
          setRestoreStatusMsg(msg);
          setRestoreProgress(percent);
        }
      );

      setRestoreResult({
        success: res.success,
        message: res.message
      });

      if (res.success && onRestoreComplete) {
        onRestoreComplete();
      }
    } catch (err: any) {
      setRestoreResult({
        success: false,
        message: 'Unexpected error during restore: ' + (err.message || String(err))
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white border-4 border-slate-900 rounded-3xl shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-b-4 border-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-2xl border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider font-mono">
                Data Backup & Recovery Center
              </h2>
              <p className="text-xs font-semibold text-emerald-100">
                Safeguard app state or recover data after server resets
              </p>
            </div>
          </div>
          <button
            id="btn-close-backup-modal"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Section 1: DOWNLOAD BACKUP */}
          <div className="p-5 bg-emerald-50/80 border-3 border-slate-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <div className="flex items-center gap-2 text-emerald-950 font-black uppercase tracking-wider text-xs font-mono">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>1. Download Local Data Backup</span>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Export a complete snapshot of all shared expenses, roster shifts, coin Insertion logs, private finance records, and roommate profiles to a single JSON file on your computer/phone.
            </p>

            {downloadError && (
              <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{downloadError}</span>
              </div>
            )}

            {downloadSuccess && (
              <div className="p-3.5 bg-emerald-100 border-2 border-emerald-600 rounded-xl text-xs font-bold text-emerald-950 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Backup file downloaded successfully!</span>
                </div>
                <div className="text-[11px] font-mono font-normal text-emerald-800 pl-6">
                  Saved: <strong className="font-bold text-emerald-950">{downloadSuccess.fileName}</strong> ({downloadSuccess.itemCount} total records)
                </div>
              </div>
            )}

            <button
              id="btn-download-backup-now"
              type="button"
              disabled={isDownloading}
              onClick={handleDownload}
              className="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer font-sans"
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Backup Package...</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4" />
                  <span>Download Backup JSON File</span>
                </>
              )}
            </button>
          </div>

          <hr className="border-t-2 border-slate-200" />

          {/* Section 2: RESTORE BACKUP */}
          <div className="p-5 bg-indigo-50/80 border-3 border-slate-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <div className="flex items-center gap-2 text-indigo-950 font-black uppercase tracking-wider text-xs font-mono">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>2. Upload & Restore Backup</span>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Select a previously downloaded backup JSON file to restore all your transactions, shifts, and settings into the system.
            </p>

            {/* File Input */}
            <div className="relative">
              <label 
                htmlFor="backup-file-upload" 
                className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-indigo-400 rounded-2xl bg-white hover:bg-indigo-50/50 cursor-pointer transition-all text-center"
              >
                <FileJson className="w-8 h-8 text-indigo-500 mb-1" />
                <span className="text-xs font-bold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Click to browse or drag backup JSON file here'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Supported format: .json
                </span>
                <input
                  id="backup-file-upload"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isRestoring}
                />
              </label>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Verified Backup Summary */}
            {backupPackage && (
              <div className="p-4 bg-white border-2 border-indigo-300 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">
                      Backup File Verified
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    Exported: {backupPackage.exportedAt ? new Date(backupPackage.exportedAt).toLocaleString() : 'N/A'}
                  </span>
                </div>

                <div className="text-xs font-medium text-slate-700 leading-normal">
                  {validationSummary}
                </div>

                {/* Collection item counts badge list */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {Object.entries(backupPackage.collectionsCount || {}).map(([col, count]) => (
                    <div key={col} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono flex items-center justify-between">
                      <span className="text-slate-600 font-semibold truncate">{col}</span>
                      <span className="font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{count}</span>
                    </div>
                  ))}
                </div>

                {/* Restore Mode Choice */}
                <div className="pt-2 space-y-2 border-t">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 font-mono block">
                    Select Restore Strategy:
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRestoreMode('merge')}
                      className={`p-2.5 rounded-xl text-left border-2 transition-all cursor-pointer ${
                        restoreMode === 'merge'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold shadow-[2px_2px_0px_0px_rgba(79,70,229,1)]'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-black flex items-center gap-1.5">
                        <span>🔄 Merge & Update</span>
                        {restoreMode === 'merge' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 ml-auto" />}
                      </div>
                      <div className="text-[9px] font-normal text-slate-500 mt-0.5">
                        Safely adds backup items & updates matching records. Keeps existing data intact.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRestoreMode('overwrite')}
                      className={`p-2.5 rounded-xl text-left border-2 transition-all cursor-pointer ${
                        restoreMode === 'overwrite'
                          ? 'border-rose-600 bg-rose-50 text-rose-950 font-bold shadow-[2px_2px_0px_0px_rgba(225,29,72,1)]'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-black flex items-center gap-1.5 text-rose-800">
                        <span>⚠️ Full Overwrite / Replace</span>
                        {restoreMode === 'overwrite' && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 ml-auto" />}
                      </div>
                      <div className="text-[9px] font-normal text-slate-500 mt-0.5">
                        Erases current database collections first, then restores exact backup snapshot.
                      </div>
                    </button>
                  </div>
                </div>

                {/* Confirm Restore Button */}
                <button
                  id="btn-execute-restore"
                  type="button"
                  disabled={isRestoring}
                  onClick={handleRestore}
                  className="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer font-sans mt-3"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Restoring Database ({restoreProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Start Restore ({restoreMode === 'overwrite' ? 'Full Replace' : 'Safe Merge'})</span>
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Progress Bar & Status */}
            {isRestoring && (
              <div className="p-4 bg-white border-2 border-indigo-400 rounded-2xl space-y-2 animate-pulse">
                <div className="flex items-center justify-between text-xs font-black text-indigo-900 font-mono">
                  <span>{restoreStatusMsg}</span>
                  <span>{restoreProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-300">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${restoreProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Restore Result Banner */}
            {restoreResult && (
              <div className={`p-4 border-2 rounded-2xl text-xs font-bold space-y-2 ${
                restoreResult.success 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950' 
                  : 'bg-rose-50 border-rose-500 text-rose-950'
              }`}>
                <div className="flex items-center gap-2 text-sm font-black uppercase font-mono">
                  {restoreResult.success ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>Data Restoration Complete!</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>Restoration Failed</span>
                    </>
                  )}
                </div>
                <p className="text-xs font-medium leading-relaxed">
                  {restoreResult.message}
                </p>
                {restoreResult.success && (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.reload();
                    }}
                    className="mt-2 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reload Page to Refresh Data</span>
                  </button>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t-2 border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>End-to-End Local Backup & Restore Protocol</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 border-2 border-slate-900 transition-all cursor-pointer font-sans"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
