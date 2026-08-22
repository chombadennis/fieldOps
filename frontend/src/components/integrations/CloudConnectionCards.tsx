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
}: CloudConnectionCardsProps) {
  const isGeneralDrive = ['department', 'activity_schedule', 'milestone_payments'].includes(moduleContext);

  return (
    <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100 transition-all duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Cloud Integrations</h2>
        <p className="text-sm text-gray-500 mt-1">Connect your project database with live spreadsheets for bi-directional updates.</p>
      </div>

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-md mb-6 text-sm">
          {success}
        </div>
      )}

      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs sm:text-sm text-amber-900 leading-relaxed mb-6">
        <div className="flex items-center space-x-2 text-amber-800 font-bold mb-1.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-bold">
            {moduleContext === 'ipc' ? 'Spreadsheet Linking Guidelines' : 'Workspace Format Requirements'}
          </span>
        </div>
        <p className="text-xs text-amber-850">
          {formatGuidelines}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Sheets Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-6 border border-emerald-100 flex flex-col justify-between hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10H7v-2h10v2m0-4H7V7h10v2m0 8H7v-2h10v2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {isGeneralDrive ? 'Google Drive' : 'Google Sheets'}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              {isGeneralDrive
                ? 'Link any document format directly from Google Drive. Support inline previews for sheets, docs, and PDFs.'
                : 'Link sheets directly from Google Drive. Access updates in real-time or trigger imports on demand.'}
            </p>
          </div>
          <button
            disabled={isLoading}
            onClick={() => handleOAuthInitiate('google')}
            className="w-full flex justify-center py-2.5 px-4 border border-emerald-600 rounded-xl shadow-sm text-sm font-bold text-emerald-700 bg-white hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneralDrive ? 'Connect Google Drive' : 'Connect Google Sheets'}
          </button>
        </div>

        {/* OneDrive Excel Card */}
        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-6 border border-indigo-100 flex flex-col justify-between hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Microsoft OneDrive</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              {isGeneralDrive
                ? 'Link any document format securely from Microsoft 365 OneDrive. Support inline previews for sheets, docs, and PDFs.'
                : 'Import Microsoft Excel spreadsheets securely from Microsoft 365 OneDrive.'}
            </p>
          </div>
          <button
            disabled={isLoading}
            onClick={() => handleOAuthInitiate('onedrive')}
            className="w-full flex justify-center py-2.5 px-4 border border-indigo-600 rounded-xl shadow-sm text-sm font-bold text-indigo-700 bg-white hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect OneDrive
          </button>
        </div>
      </div>
    </div>
  );
}
