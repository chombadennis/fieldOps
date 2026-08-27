import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface CustomAlertProps {
  type: AlertType;
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function CustomAlert({ type, message, onClose, duration = 4000 }: CustomAlertProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration <= 0) return;

    const interval = 10; // update every 10ms
    const step = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [duration, onClose]);

  const styles = {
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
      progress: 'bg-emerald-500',
      text: 'text-emerald-800'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      progress: 'bg-red-500',
      text: 'text-red-800'
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      progress: 'bg-amber-500',
      text: 'text-amber-800'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: <Info className="w-5 h-5 text-blue-600" />,
      progress: 'bg-blue-500',
      text: 'text-blue-800'
    }
  };

  const theme = styles[type] || styles.info;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-down">
      <div className={`relative overflow-hidden rounded-2xl shadow-xl border ${theme.bg} ${theme.border} backdrop-blur-md min-w-[300px] max-w-md w-full`}>
        <div className="flex items-start p-4">
          <div className="flex-shrink-0 mt-0.5">
            {theme.icon}
          </div>
          <div className={`ml-3 w-0 flex-1 pt-0.5 ${theme.text}`}>
            <p className="text-sm font-bold font-lexend">{message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className={`rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {duration > 0 && (
          <div className="absolute bottom-0 left-0 h-1 w-full bg-black/5">
            <div
              className={`h-full ${theme.progress} transition-all duration-75 ease-linear`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
