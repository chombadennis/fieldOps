'use client';

import { useState, useEffect } from 'react';
import { getIntegrationEmbedUrl } from '@/services/api';
import {
  Edit,
  Eye,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface EmbeddedSheetEditorProps {
  integrationId: number;
  provider: string;
  spreadsheetId: string;
  boqName?: string;
}

export default function EmbeddedSheetEditor({
  integrationId,
  provider,
  spreadsheetId,
  boqName
}: EmbeddedSheetEditorProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);

  const isGoogle = provider === 'google_sheets';
  const providerName = isGoogle ? 'Google Sheets' : 'OneDrive Excel';

  useEffect(() => {
    async function fetchEmbedUrl() {
      setLoading(true);
      setError(null);
      try {
        const data = await getIntegrationEmbedUrl(integrationId, 'view');
        if (data && data.url) {
          setEmbedUrl(data.url);
        } else {
          setError('Failed to retrieve embed URL from server.');
        }
      } catch (err: any) {
        console.error('Error fetching embed URL:', err);
        setError(err.response?.data?.detail || 'An error occurred while loading the sheet.');
      } finally {
        setLoading(false);
      }
    }

    fetchEmbedUrl();
  }, [integrationId, retryCount]);

  const handleReload = () => {
    setIframeKey(prev => prev + 1);
  };


  return (
    <div className="mt-4 border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-inner transition-all duration-300">
      {/* Control bar */}
      <div className="bg-gray-50/80 backdrop-blur-sm px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isGoogle ? 'bg-emerald-500' : 'bg-indigo-500'} animate-pulse`} />
          <span className="text-xs font-bold text-gray-700 font-sans">
            Inline Preview: {boqName || 'Linked Document'}
          </span>
        </div>

        {/* Tools and Toggles */}
        <div className="flex items-center space-x-2">
          {/* Action buttons */}
          <button
            onClick={handleReload}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200/50 rounded-lg active:scale-95 transition-all"
            title="Reload Spreadsheet"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-gray-300 mx-1" />

          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/integrations/${integrationId}/open`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-white rounded-lg active:scale-[0.98] transition-all text-xs font-bold shadow-sm ${isGoogle
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-indigo-650 hover:bg-indigo-750 bg-indigo-600'
              }`}
            title={`Open and edit spreadsheet directly in ${isGoogle ? 'Google Sheets' : 'Excel Online'}`}
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit in {isGoogle ? 'Google Sheets' : 'Excel Online'}</span>
          </a>
        </div>
      </div>

      {/* Editor Frame Container */}
      <div className="relative min-h-[1200px] w-full bg-gray-50 flex flex-col justify-center items-center">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/90 z-10 animate-fade-in">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs text-gray-500 font-medium mt-3">Loading spreadsheet from {providerName}...</p>
          </div>
        )}

        {error && (
          <div className="p-6 text-center max-w-md bg-white rounded-2xl shadow-md border border-red-100 m-4 animate-scale-up">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-gray-800">Connection Failed</h4>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                setRetryCount(prev => prev + 1);
              }}
              className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-xl transition-all active:scale-95"
            >
              Retry Connection
            </button>
          </div>
        )}

        {!loading && !error && embedUrl && (
          <iframe
            key={iframeKey}
            src={embedUrl}
            width="100%"
            height="700"
            className="border-none w-full shadow-inner animate-fade-in"
            allow="autoplay; clipboard-write; encrypted-media"
          />
        )}
      </div>

      {/* Footer Instructions Banner */}
      <div className="bg-amber-50/60 px-4 py-3 border-t border-gray-150 text-[11px] text-amber-900 leading-relaxed flex items-start space-x-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Authentication Note:</span> The embed environment relies on your active browser session. If you see a login screen or a permission error, please click the sign-in prompt inside the window or click <span className="font-semibold">Open Tab</span> to log in directly to your {providerName} account.
        </div>
      </div>
    </div>
  );
}
