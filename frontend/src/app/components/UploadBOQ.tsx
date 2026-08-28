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
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <h2 className="text-2xl font-bold font-lexend text-white mb-4 drop-shadow-md">Upload PDF BoQ</h2>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs sm:text-sm text-amber-200 leading-relaxed mb-4 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
        <div className="flex items-center space-x-1.5 text-amber-400 font-bold mb-1">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-bold">PDF Upload Only</span>
        </div>
        Upload scanned or digital <strong className="font-bold text-amber-400">PDF Bills of Quantities</strong> for AI extraction. (For Excel/Workbooks, please use the Cloud Linking tool below).
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="boq-file" className="block text-sm font-semibold text-gray-300">
            BoQ File (PDF only)
          </label>
          <input
            id="boq-file"
            type="file"
            disabled={disabled || uploading}
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 disabled:opacity-50 transition-colors file:cursor-pointer cursor-pointer focus:outline-none"
            accept=".pdf"
          />
        </div>
        
        {error && !rejectedRetry && <p className="text-red-400 text-sm font-medium drop-shadow-sm">{error}</p>}
        
        {success && <p className="text-neon-cyan text-sm font-bold drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">File parsed and saved successfully!</p>}
        
        {disabled && (
          <p className="text-amber-400 text-sm font-semibold">
            Upload is disabled because a spreadsheet sync/link operation is in progress.
          </p>
        )}
        
        <button
          onClick={() => handleUpload(false)}
          disabled={disabled || !file || uploading || rejectedRetry}
          className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl text-sm font-bold transition-all mt-2 ${
            (!file || disabled || uploading || rejectedRetry) 
            ? 'bg-white/10 text-gray-500 cursor-not-allowed' 
            : 'text-black bg-neon-cyan hover:bg-white shadow-[0_0_20px_rgba(0,243,255,0.2)] active:scale-[0.98]'
          }`}
        >
          Validate & Preview Data
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
    </div>
  );
}
