'use client';

import { useState } from 'react';
import { validateUploadBoq, commitUploadBoq } from '@/services/api';
import { AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import BoqExtractionPreviewModal from './integrations/BoqExtractionPreviewModal';

interface UploadBOQProps {
  projectId: string;
  contractId?: number;
  onUploadSuccess?: () => void;
  disabled?: boolean;
}

export default function UploadBOQ({ projectId, contractId, onUploadSuccess, disabled }: UploadBOQProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Preview Modal State
  const [showPreview, setShowPreview] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [tempFileId, setTempFileId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rejectedRetry, setRejectedRetry] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setSuccess(false);
      setError(null);
      setRejectedRetry(false);
    }
  };

  const handleUpload = async (forceRetry: boolean = false) => {
    if (!file) {
      setError('Please select a PDF file to upload.');
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported for manual upload. For Excel files, please use the Cloud Link option.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);
    setRejectedRetry(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_id', String(projectId));
      if (contractId) formData.append('contract_id', String(contractId));
      if (forceRetry) formData.append('force_retry', 'true');

      const response = await validateUploadBoq(projectId, contractId, formData);
      
      if (!response.valid) {
        setRejectedRetry(true);
        setError(response.message || 'File validation failed.');
        return;
      }

      setExtractedData(response.extracted_data);
      setTempFileId(response.temp_file_id);
      setShowPreview(true);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'File validation failed. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const [commitError, setCommitError] = useState<string | null>(null);

  const handleCommitSave = async (finalData: any) => {
    setIsSaving(true);
    setCommitError(null);
    try {
      await commitUploadBoq(projectId, contractId, {
        project_id: Number(projectId),
        contract_id: contractId ? Number(contractId) : undefined,
        temp_file_id: tempFileId,
        file_hash: tempFileId || '', // Passed the temp_file_id as the hash to fix the 422 Unprocessable Entity
        title: file?.name || 'Uploaded BOQ',
        items: finalData.boq_items,
        project_metadata: finalData.project_metadata,
      });

      setSuccess(true);
      setShowPreview(false);
      setFile(null);
      
      const input = document.getElementById('boq-file') as HTMLInputElement;
      if (input) input.value = '';
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setCommitError(err.response?.data?.detail || 'Failed to save parsed data. Please try again.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col justify-between hover:shadow-[0_0_30px_rgba(0,243,255,0.15)] hover:border-neon-cyan/50 transition-all duration-300 transform hover:-translate-y-0.5 group h-full">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 bg-neon-cyan/10 border border-neon-cyan/20 rounded-xl text-neon-cyan shadow-[0_0_10px_rgba(0,243,255,0.2)]">
            <FileText className="w-5 h-5" />
          </div>
        </div>
        <h3 className="text-base font-bold font-lexend text-white mb-1.5 drop-shadow-md">Upload PDF BoQ</h3>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200 leading-relaxed mb-4 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
          <div className="flex items-center space-x-1.5 text-amber-400 font-bold mb-1">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs font-bold">PDF Upload Only</span>
          </div>
          Upload <strong className="font-bold text-amber-400">PDF BoQs</strong> for AI extraction. (For Excel, use Cloud Links).
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label htmlFor="boq-file" className="block text-xs font-semibold text-gray-400 mb-1">
              BoQ File
            </label>
            <input
              id="boq-file"
              type="file"
              disabled={disabled || uploading}
              onChange={handleFileChange}
              className="block w-full text-[11px] text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 disabled:opacity-50 transition-colors file:cursor-pointer cursor-pointer focus:outline-none"
              accept=".pdf"
            />
          </div>
          
          {error && !rejectedRetry && <p className="text-red-400 text-[11px] font-medium drop-shadow-sm">{error}</p>}
          
          {success && <p className="text-neon-cyan text-[11px] font-bold drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">File parsed and saved successfully!</p>}
          
          {disabled && (
            <p className="text-amber-400 text-[11px] font-semibold">
              Upload disabled: Sync in progress.
            </p>
          )}
        </div>
      </div>
      
      <button
        onClick={() => handleUpload(false)}
        disabled={disabled || !file || uploading || rejectedRetry}
        className={`w-full flex justify-center py-2 px-4 border rounded-xl text-xs font-bold transition-all mt-auto ${
          (!file || disabled || uploading || rejectedRetry) 
          ? 'bg-white/10 text-gray-500 cursor-not-allowed border-transparent' 
          : 'border-neon-cyan/50 text-neon-cyan bg-neon-cyan/10 hover:bg-neon-cyan hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.1)] active:scale-[0.98]'
        }`}
      >
        Validate & Preview
      </button>
    </div>

      {/* Floating Loading Modal */}
      {uploading && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#030305]/80 backdrop-blur-md"></div>
          <div className="relative bg-gradient-to-b from-[#1a1c23] to-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl p-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(0,243,255,0.3)]"></div>
            <h3 className="text-white text-xl font-bold mb-2">Validating & Parsing AI...</h3>
            <p className="text-gray-400 text-sm text-center">Please wait while the AI analyzes the document.</p>
          </div>
        </div>
      )}

      {/* Rejection Override Modal */}
      {rejectedRetry && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#030305]/80 backdrop-blur-md"></div>
          <div className="relative max-w-lg w-full bg-gradient-to-b from-[#2a1114] to-[#1a0a0c] border border-red-500/30 rounded-2xl shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-full border border-red-500/30">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-white text-xl font-bold">Document Rejected</h3>
            </div>
            <p className="text-red-200 text-sm mb-6 leading-relaxed bg-red-950/40 p-4 rounded-xl border border-red-500/20">
              {error}
            </p>
            <div className="flex space-x-3 justify-end mt-2">
              <button
                onClick={() => {
                  setRejectedRetry(false);
                  setFile(null);
                  setError(null);
                  const input = document.getElementById('boq-file') as HTMLInputElement;
                  if (input) input.value = '';
                }}
                className="px-5 py-2.5 rounded-xl border border-white/20 text-white font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpload(true)}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(220,38,38,0.4)]"
              >
                Force Rescan Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <BoqExtractionPreviewModal
        showModal={showPreview}
        onClose={() => {
          setShowPreview(false);
          setFile(null);
          setCommitError(null);
          const input = document.getElementById('boq-file') as HTMLInputElement;
          if (input) input.value = '';
        }}
        onConfirm={handleCommitSave}
        extractedData={extractedData}
        isSaving={isSaving}
        error={commitError}
      />
    </>
  );
}
