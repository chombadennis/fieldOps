'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/api';
import { Bell, CheckSquare, MessageSquare, User, Check, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationBellProps {
  userId: number;
}

interface Notification {
  id: number;
  notif_type: string;
  message?: string;
  reference_id?: number;
  reference_type?: string;
  is_read: boolean;
  created_at?: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  task_assigned:  <CheckSquare className="w-3.5 h-3.5 text-blue-400" />,
  task_completed: <Check className="w-3.5 h-3.5 text-emerald-400" />,
  reply_received: <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />,
  mention:        <User className="w-3.5 h-3.5 text-purple-400" />,
};

export default function NotificationBell({ userId }: NotificationBellProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => getUserNotifications(userId),
    enabled: !!userId,
    refetchInterval: 30000, // poll every 30s
  });

  const unreadCount = (notifications as Notification[]).filter((n) => !n.is_read).length;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkOne = async (notifId: number) => {
    await markNotificationRead(userId, notifId);
    queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(userId);
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(99,102,241,0.6)] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-[#0e0e14] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] z-50 overflow-hidden animate-fade-in">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-indigo-400" />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-indigo-500/20 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-indigo-500/30">
                  {unreadCount} new
                </span>
              )}
            </h4>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="text-[10px] font-bold text-gray-500 hover:text-white transition flex items-center gap-1"
              >
                {markingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              </div>
            ) : (notifications as Notification[]).length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">All caught up!</p>
              </div>
            ) : (
              <div>
                {(notifications as Notification[]).map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 transition-colors cursor-pointer ${
                      notif.is_read ? 'opacity-50 hover:opacity-70' : 'hover:bg-white/5'
                    }`}
                    onClick={() => !notif.is_read && handleMarkOne(notif.id)}
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mt-0.5">
                      {TYPE_ICON[notif.notif_type] || <Bell className="w-3.5 h-3.5 text-gray-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-300 leading-snug">{notif.message || notif.notif_type}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {notif.created_at ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }) : ''}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
