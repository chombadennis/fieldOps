'use client';

import { useState } from 'react';
import { uploadFile } from '@/services/api';
import { AlertTriangle } from 'lucide-react';

interface UploadBOQProps {
  projectId: string;
  onUploadSuccess?: () => void;
  disabled?: boolean;
}

export default function UploadBOQ({ projectId, onUploadSuccess, disabled }: UploadBOQProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setSuccess(false);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      await uploadFile(file, projectId);
      setSuccess(true);
      setFile(null);
      
      // Reset input element
      const input = document.getElementById('boq-file') as HTMLInputElement;
      if (input) input.value = '';
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'File upload failed. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <h2 className="text-2xl font-bold font-lexend text-white mb-4 drop-shadow-md">Upload Bill of Quantities</h2>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs sm:text-sm text-amber-200 leading-relaxed mb-4 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
        <div className="flex items-center space-x-1.5 text-amber-400 font-bold mb-1">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-bold">BOQ Formatting Note</span>
        </div>
        Uploaded files must contain standard BOQ structures (<strong className="font-bold text-amber-400">Description, Qty, Rate, Amount</strong>). Avoid uploading progress templates, charts, or activity checklists.
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="boq-file" className="block text-sm font-semibold text-gray-300">
            BOQ File (Excel or PDF)
          </label>
          <input
            id="boq-file"
            type="file"
            disabled={disabled || uploading}
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 disabled:opacity-50 transition-colors file:cursor-pointer cursor-pointer focus:outline-none"
            accept=".xls,.xlsx,.pdf"
          />
        </div>
        {error && <p className="text-red-400 text-sm font-medium drop-shadow-sm">{error}</p>}
        {success && <p className="text-neon-cyan text-sm font-bold drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">File uploaded successfully!</p>}
        {disabled && (
          <p className="text-amber-400 text-sm font-semibold">
            Upload is disabled because a spreadsheet sync/link operation is in progress.
          </p>
        )}
        <button
          onClick={handleUpload}
          disabled={disabled || !file || uploading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-[0_0_20px_rgba(0,243,255,0.2)] text-sm font-bold text-black bg-neon-cyan hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#030305] focus:ring-neon-cyan disabled:opacity-50 transition-all active:scale-[0.98] mt-2"
        >
          {uploading ? 'Uploading & Parsing...' : 'Upload & Parse'}
        </button>
      </div>
    </div>
  );
}
