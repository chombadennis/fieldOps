import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Integration } from './types';

interface CloudConnectionCardsProps {
  success: string | null;
  moduleContext: 'ipc' | 'budget' | 'department' | 'boq' | 'activity_schedule' | 'milestone_payments';
  departmentName: string;
  googleIntegration?: Integration;
  onedriveIntegration?: Integration;
  isLoading: boolean;
  handleOAuthInitiate: (provider: 'google' | 'onedrive') => void;
  formatGuidelines: string;
  onManualEntryClick?: () => void;
  children?: React.ReactNode;
}

export default function CloudConnectionCards({
  success,
  moduleContext,
  departmentName,
  googleIntegration,
  onedriveIntegration,
  isLoading,
  handleOAuthInitiate,
  formatGuidelines,
  onManualEntryClick,
  children,
}: CloudConnectionCardsProps) {
  const isGeneralDrive = ['department', 'activity_schedule', 'milestone_payments'].includes(moduleContext);

  return (
    <div className="relative bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl p-5 border border-white/10 transition-all duration-300 overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-[#030305]/80 backdrop-blur-xl flex flex-col items-center justify-center">
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
            {/* Pulsing expanding rings */}
            <div className="absolute w-full h-full bg-neon-cyan/20 rounded-full animate-ping" style={{ animationDuration: '2.5s' }}></div>
            <div className="absolute w-12 h-12 bg-neon-purple/30 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}></div>
            <div className="absolute w-16 h-16 border border-white/10 rounded-full animate-pulse"></div>
            
            {/* Core glowing orb */}
            <div className="relative z-10 w-8 h-8 bg-gradient-to-tr from-neon-cyan to-neon-purple rounded-full shadow-[0_0_30px_rgba(0,243,255,0.8)] animate-pulse"></div>
            
            {/* Orbiting particles */}
            <div className="absolute w-full h-full animate-spin" style={{ animationDuration: '3s' }}>
              <div className="absolute -top-1 left-1/2 w-2 h-2 bg-neon-cyan rounded-full shadow-[0_0_10px_#00f3ff]"></div>
            </div>
            <div className="absolute w-full h-full animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
              <div className="absolute -bottom-1 left-1/2 w-2 h-2 bg-neon-purple rounded-full shadow-[0_0_10px_#bc13fe]"></div>
            </div>
          </div>
          <p className="text-sm font-bold font-lexend text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple animate-pulse">
            Establishing Secure Connection...
          </p>
          <p className="text-[10px] text-gray-400 mt-2">Checking database for accounts and syncing cloud metadata</p>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-lg font-bold font-lexend text-white drop-shadow-md">Cloud Integrations</h2>
        <p className="text-xs text-gray-400 mt-1">Connect your project database with live spreadsheets for bi-directional updates.</p>
      </div>

      {success && (
        <div className="bg-neon-cyan/10 border-l-4 border-neon-cyan text-neon-cyan p-3 rounded-md mb-4 text-xs font-semibold shadow-[0_0_10px_rgba(0,243,255,0.1)]">
          {success}
        </div>
      )}

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 leading-relaxed mb-5 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
        <div className="flex items-center space-x-2 text-amber-400 font-bold mb-1">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-bold">
            {moduleContext === 'ipc' ? 'Spreadsheet Linking Guidelines' : 'Workspace Format Requirements'}
          </span>
        </div>
        <p className="text-[11px] text-amber-200/80">
          {formatGuidelines}
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${onManualEntryClick || children ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {/* Google Sheets Card */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col justify-between hover:shadow-[0_0_30px_rgba(0,243,255,0.15)] hover:border-neon-cyan/50 transition-all duration-300 transform hover:-translate-y-0.5 group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-neon-cyan/10 border border-neon-cyan/20 rounded-xl text-neon-cyan shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10H7v-2h10v2m0-4H7V7h10v2m0 8H7v-2h10v2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-base font-bold font-lexend text-white mb-1.5 drop-shadow-md">
              {isGeneralDrive ? 'Google Drive' : 'Google Sheets'}
            </h3>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
              {isGeneralDrive
                ? 'Link any document format directly from Google Drive. Support inline previews for sheets, docs, and PDFs.'
                : 'Link sheets directly from Google Drive. Access updates in real-time or trigger imports on demand.'}
            </p>
          </div>
          <button
            disabled={isLoading}
            onClick={() => handleOAuthInitiate('google')}
            className="w-full flex justify-center py-2 px-4 border border-neon-cyan/50 rounded-xl shadow-[0_0_15px_rgba(0,243,255,0.1)] text-xs font-bold text-neon-cyan bg-neon-cyan/10 hover:bg-neon-cyan hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneralDrive ? 'Connect Google Drive' : 'Connect Google Sheets'}
          </button>
        </div>

        {/* OneDrive Excel Card */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col justify-between hover:shadow-[0_0_30px_rgba(188,19,254,0.15)] hover:border-neon-purple/50 transition-all duration-300 transform hover:-translate-y-0.5 group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-neon-purple/10 border border-neon-purple/20 rounded-xl text-neon-purple shadow-[0_0_10px_rgba(188,19,254,0.2)]">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-base font-bold font-lexend text-white mb-1.5 drop-shadow-md">Microsoft OneDrive</h3>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
              {isGeneralDrive
                ? 'Link any document format securely from Microsoft 365 OneDrive. Support inline previews for sheets, docs, and PDFs.'
                : 'Import Microsoft Excel spreadsheets securely from Microsoft 365 OneDrive.'}
            </p>
          </div>
          <button
            disabled={isLoading}
            onClick={() => handleOAuthInitiate('onedrive')}
            className="w-full flex justify-center py-2 px-4 border border-neon-purple/50 rounded-xl shadow-[0_0_15px_rgba(188,19,254,0.1)] text-xs font-bold text-neon-purple bg-neon-purple/10 hover:bg-neon-purple hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect OneDrive
          </button>
        </div>

        {/* Manual Entry Card */}
        {onManualEntryClick && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col justify-between hover:shadow-[0_0_30px_rgba(255,0,127,0.15)] hover:border-neon-pink/50 transition-all duration-300 transform hover:-translate-y-0.5 group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-neon-pink/10 border border-neon-pink/20 rounded-xl text-neon-pink shadow-[0_0_10px_rgba(255,0,127,0.2)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-base font-bold font-lexend text-white mb-1.5 drop-shadow-md">Manual Entry</h3>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
                Don't have a spreadsheet? Create a manual entry using a dynamic form to log your data directly.
              </p>
            </div>
            <button
              disabled={isLoading}
              onClick={onManualEntryClick}
              className="w-full flex justify-center py-2 px-4 border border-neon-pink/50 rounded-xl shadow-[0_0_15px_rgba(255,0,127,0.1)] text-xs font-bold text-neon-pink bg-neon-pink/10 hover:bg-neon-pink hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Manual Entry
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
