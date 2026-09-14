import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjectActivityFeed } from '@/services/api';
import { format, formatDistanceToNow } from 'date-fns';
import { Loader2, FileText, MessageCircle, ShieldCheck, Target, Activity, Clock } from 'lucide-react';

interface ActivityFeedProps {
  projectId: number;
}

export default function ActivityFeed({ projectId }: ActivityFeedProps) {
  const { data: feed = [], isLoading } = useQuery({
    queryKey: ['activityFeed', projectId],
    queryFn: () => getProjectActivityFeed(projectId),
    enabled: !!projectId,
    refetchInterval: 60000 // Refetch every minute
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'note': return <MessageCircle className="w-4 h-4 text-indigo-400" />;
      case 'decision': return <ShieldCheck className="w-4 h-4 text-amber-400" />;
      case 'action': return <Target className="w-4 h-4 text-blue-400" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case 'document': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'note': return 'bg-indigo-500/10 border-indigo-500/20';
      case 'decision': return 'bg-amber-500/10 border-amber-500/20';
      case 'action': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          Project Heartbeat
        </h3>
        <span className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">
          <Clock className="w-3 h-3" /> Live Feed
        </span>
      </div>

      {feed.length === 0 ? (
        <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-xs font-medium text-gray-400">No recent activity detected.</p>
        </div>
      ) : (
        <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
          {feed.map((item: any, index: number) => {
            const isDocument = item.type === 'document';
            const isNote = item.type === 'note';
            const isDecision = item.type === 'decision';
            const isAction = item.type === 'action';

            return (
              <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                {/* Timeline Marker */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#030305] bg-black shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  <div className={`p-2 rounded-full border ${getColorClass(item.type)}`}>
                    {getIcon(item.type)}
                  </div>
                </div>

                {/* Content Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-xs font-bold text-white flex-1 mr-2">{item.title}</h4>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                      {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 mb-3 line-clamp-3">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                      {item.department || 'General'}
                    </span>
                    {item.metadata?.status && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getColorClass(item.type)}`}>
                        {item.metadata.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
