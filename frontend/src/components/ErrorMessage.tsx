import { AlertTriangle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 flex flex-col items-center justify-center text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-gray-800">An Error Occurred</h2>
      <p className="mt-2 text-gray-600">{message}</p>
      <p className="mt-2 text-sm text-gray-500">Please try refreshing the page or contact support if the problem persists.</p>
    </div>
  );
}