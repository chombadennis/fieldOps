import React from 'react';
import { X, Code, Copy, CheckCircle2 } from 'lucide-react';

interface SourceExtractionViewerModalProps {
  show: boolean;
  onClose: () => void;
  extractionData: any;
  certificateNumber: string;
}

export default function SourceExtractionViewerModal({ show, onClose, extractionData, certificateNumber }: SourceExtractionViewerModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!show) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(extractionData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <Code className="w-6 h-6 text-slate-100" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-wide flex items-center">
                Raw Extraction Payload (IPC #{certificateNumber})
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                This is the secure, deeply extracted data payload safely stored in the database.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleCopy}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center transition-colors border border-white/20 shadow-sm"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied Payload' : 'Copy JSON'}
            </button>
            <button onClick={onClose} className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 bg-slate-50 flex-1 overflow-y-auto">
          {extractionData ? (
            <pre className="bg-slate-900 text-slate-300 p-6 rounded-xl text-xs font-mono overflow-x-auto shadow-inner border border-slate-700 leading-relaxed">
              {JSON.stringify(extractionData, null, 2)}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 italic text-sm">
              No extraction data available for this IPC.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
