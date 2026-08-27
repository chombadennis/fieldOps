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
}: CloudConnectionCardsProps) {
  const isGeneralDrive = ['department', 'activity_schedule', 'milestone_payments'].includes(moduleContext);

  return (
    <div className="bg-white shadow-md rounded-2xl p-5 border border-gray-100 transition-all duration-300">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-800">Cloud Integrations</h2>
        <p className="text-xs text-gray-500 mt-1">Connect your project database with live spreadsheets for bi-directional updates.</p>
      </div>

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 rounded-md mb-4 text-xs">
          {success}
        </div>
      )}

      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed mb-5">
        <div className="flex items-center space-x-2 text-amber-800 font-bold mb-1">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-bold">
            {moduleContext === 'ipc' ? 'Spreadsheet Linking Guidelines' : 'Workspace Format Requirements'}
          </span>
        </div>
        <p className="text-[11px] text-amber-850">
          {formatGuidelines}
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${onManualEntryClick ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {/* Google Sheets Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-4 border border-emerald-100 flex flex-col justify-between hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10H7v-2h10v2m0-4H7V7h10v2m0 8H7v-2h10v2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1.5">
              {isGeneralDrive ? 'Google Drive' : 'Google Sheets'}
            </h3>
            <p className="text-[11px] text-gray-600 leading-relaxed mb-4">
              {isGeneralDrive
                ? 'Link any document format directly from Google Drive. Support inline previews for sheets, docs, and PDFs.'
                : 'Link sheets directly from Google Drive. Access updates in real-time or trigger imports on demand.'}
            </p>
          </div>
          <button
            disabled={isLoading}
            onClick={() => handleOAuthInitiate('google')}
            className="w-full flex justify-center py-2 px-4 border border-emerald-600 rounded-xl shadow-sm text-xs font-bold text-emerald-700 bg-white hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneralDrive ? 'Connect Google Drive' : 'Connect Google Sheets'}
          </button>
        </div>

        {/* OneDrive Excel Card */}
        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-4 border border-indigo-100 flex flex-col justify-between hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1.5">Microsoft OneDrive</h3>
            <p className="text-[11px] text-gray-600 leading-relaxed mb-4">
              {isGeneralDrive
                ? 'Link any document format securely from Microsoft 365 OneDrive. Support inline previews for sheets, docs, and PDFs.'
                : 'Import Microsoft Excel spreadsheets securely from Microsoft 365 OneDrive.'}
            </p>
          </div>
          <button
            disabled={isLoading}
            onClick={() => handleOAuthInitiate('onedrive')}
            className="w-full flex justify-center py-2 px-4 border border-indigo-600 rounded-xl shadow-sm text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect OneDrive
          </button>
        </div>

        {/* Manual Entry Card */}
        {onManualEntryClick && (
          <div className="bg-gradient-to-br from-orange-50 to-white rounded-xl p-4 border border-orange-100 flex flex-col justify-between hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-orange-50 rounded-xl text-orange-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1.5">Manual Entry</h3>
              <p className="text-[11px] text-gray-600 leading-relaxed mb-4">
                Don't have a spreadsheet? Create a manual entry using a dynamic form to log your data directly.
              </p>
            </div>
            <button
              disabled={isLoading}
              onClick={onManualEntryClick}
              className="w-full flex justify-center py-2 px-4 border border-orange-600 rounded-xl shadow-sm text-xs font-bold text-orange-700 bg-white hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Manual Entry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
