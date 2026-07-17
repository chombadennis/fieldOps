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
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Upload Bill of Quantities</h2>

      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-950 leading-relaxed mb-4">
        <div className="flex items-center space-x-1.5 text-amber-800 font-bold mb-1">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>BOQ Formatting Note</span>
        </div>
        Uploaded files must contain standard BOQ structures (<strong className="font-bold text-amber-950">Description, Qty, Rate, Amount</strong>). Avoid uploading progress templates, charts, or activity checklists.
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="boq-file" className="block text-sm font-medium text-gray-700">
            BOQ File (Excel)
          </label>
          <input
            id="boq-file"
            type="file"
            disabled={disabled || uploading}
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 disabled:opacity-50"
            accept=".xls,.xlsx"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-500 text-sm">File uploaded successfully!</p>}
        {disabled && (
          <p className="text-amber-600 text-xs font-semibold">
            Upload is disabled because a spreadsheet sync/link operation is in progress.
          </p>
        )}
        <button
          onClick={handleUpload}
          disabled={disabled || !file || uploading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {uploading ? 'Uploading & Parsing...' : 'Upload & Parse (AI)'}
        </button>
      </div>
    </div>
  );
}
