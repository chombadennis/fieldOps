'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getThreads, createThread, createThreadReply, updateThread } from '@/services/api';
import {
  MessageSquare, Plus, ChevronDown, ChevronUp, CheckCircle,
  AlertTriangle, Send, X, Loader2, MessageCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ThreadListProps {
  projectId: number;
  module: string;
  documents?: any[];
}

interface Reply {
  id: number;
  content: string;
  author_name?: string;
  is_issue?: boolean;
  created_at?: string;
}

interface Thread {
  id: number;
  subject: string;
  module: string;
  status: string;
  created_by_name?: string;
  created_at?: string;
  linked_document_ids?: number[];
  replies: Reply[];
}

const AUTHOR_NAME = 'You'; // Replace with auth context when available

export default function ThreadList({ projectId, module, documents = [] }: ThreadListProps) {
  const queryClient = useQueryClient();
  const [showNewThread, setShowNewThread] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [newFirstReply, setNewFirstReply] = useState('');
  const [linkedDocIds, setLinkedDocIds] = useState<number[]>([]);
  const [posting, setPosting] = useState(false);
  const [replyMap, setReplyMap] = useState<Record<number, string>>({});
  const [postingReplyId, setPostingReplyId] = useState<number | null>(null);
  const [isIssueMap, setIsIssueMap] = useState<Record<number, boolean>>({});

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['threads', projectId, module],
    queryFn: () => getThreads(projectId, module),
    enabled: !!projectId,
  });

  const handleCreateThread = async () => {
    if (!newSubject.trim()) return;
    setPosting(true);
    try {
      await createThread(projectId, {
        subject: newSubject,
        module,
        first_reply: newFirstReply || undefined,
        created_by_name: AUTHOR_NAME,
        linked_document_ids: linkedDocIds.length > 0 ? linkedDocIds : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['threads', projectId, module] });
      setNewSubject('');
      setNewFirstReply('');
      setLinkedDocIds([]);
      setShowNewThread(false);
    } finally {
      setPosting(false);
    }
  };

  const handlePostReply = async (threadId: number) => {
    const content = replyMap[threadId];
    if (!content?.trim()) return;
    setPostingReplyId(threadId);
    try {
      await createThreadReply(projectId, threadId, {
        content,
        author_name: AUTHOR_NAME,
        is_issue: isIssueMap[threadId] || false,
      });
      queryClient.invalidateQueries({ queryKey: ['threads', projectId, module] });
      setReplyMap((prev) => ({ ...prev, [threadId]: '' }));
      setIsIssueMap((prev) => ({ ...prev, [threadId]: false }));
    } finally {
      setPostingReplyId(null);
    }
  };

  const handleResolveThread = async (threadId: number) => {
    await updateThread(projectId, threadId, { status: 'resolved' });
    queryClient.invalidateQueries({ queryKey: ['threads', projectId, module] });
  };

  const handleReopenThread = async (threadId: number) => {
    await updateThread(projectId, threadId, { status: 'open' });
    queryClient.invalidateQueries({ queryKey: ['threads', projectId, module] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New Thread Button */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {threads.length} {threads.length === 1 ? 'thread' : 'threads'}
        </p>
        <button
          onClick={() => setShowNewThread(!showNewThread)}
          className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-xl transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          New Thread
        </button>
      </div>

      {/* New Thread Form */}
      {showNewThread && (
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-indigo-300">Start a new discussion</h4>
            <button onClick={() => setShowNewThread(false)} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Subject — what is this about? (required)"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition"
          />
          <textarea
            placeholder="Opening message (optional)..."
            value={newFirstReply}
            onChange={(e) => setNewFirstReply(e.target.value)}
            rows={3}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition resize-none"
          />
          {documents.length > 0 && (
            <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reference Documents</label>
              <div className="flex flex-wrap gap-2">
                {documents.map((doc: any) => {
                  const isSelected = linkedDocIds.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setLinkedDocIds((prev) =>
                          isSelected ? prev.filter((id) => id !== doc.id) : [...prev, doc.id]
                        );
                      }}
                      className={`px-2.5 py-1 text-[10px] rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                          : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
                      }`}
                    >
                      {doc.title || doc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end pt-2 gap-3">
            <button
              onClick={() => setShowNewThread(false)}
              className="text-xs font-semibold text-gray-500 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateThread}
              disabled={posting || !newSubject.trim()}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Post Thread
            </button>
          </div>
        </div>
      )}

      {/* Thread List */}
      {threads.length === 0 && !showNewThread ? (
        <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
          <MessageSquare className="w-7 h-7 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-medium">No discussions yet. Start a thread to collaborate.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(threads as Thread[]).map((thread) => {
            const isExpanded = expandedId === thread.id;
            const isResolved = thread.status === 'resolved';
            const replyContent = replyMap[thread.id] || '';

            return (
              <div
                key={thread.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isResolved
                    ? 'border-white/5 bg-white/[0.02]'
                    : 'border-white/10 bg-white/[0.04] hover:border-white/20'
                }`}
              >
                {/* Thread Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : thread.id)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${isResolved ? 'bg-emerald-500' : 'bg-indigo-400 animate-pulse'}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isResolved ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {thread.subject}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500">
                          {thread.created_by_name || 'Anonymous'}
                        </span>
                        <span className="text-[10px] text-gray-600">·</span>
                        <span className="text-[10px] text-gray-600">
                          {thread.created_at ? formatDistanceToNow(new Date(thread.created_at), { addSuffix: true }) : ''}
                        </span>
                        <span className="text-[10px] text-gray-600">·</span>
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                          <MessageCircle className="w-2.5 h-2.5" />
                          {thread.replies?.length || 0}
                        </span>
                      </div>
                      
                      {/* Referenced Documents Display */}
                      {thread.linked_document_ids && thread.linked_document_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {thread.linked_document_ids.map(id => {
                            const doc = documents.find(d => d.id === id);
                            if (!doc) return null;
                            return (
                              <span key={id} className="text-[9px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded flex items-center max-w-[150px] truncate">
                                {doc.title || doc.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      isResolved
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                    }`}>
                      {isResolved ? 'Resolved' : 'Open'}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </div>

                {/* Expanded: Replies + Reply Input */}
                {isExpanded && (
                  <div className="border-t border-white/5">
                    {/* Replies */}
                    {thread.replies?.length > 0 && (
                      <div className="px-4 py-3 space-y-3">
                        {thread.replies.map((reply) => (
                          <div key={reply.id} className={`flex gap-3 ${reply.is_issue ? 'bg-rose-500/5 rounded-xl px-3 py-2 border border-rose-500/10' : ''}`}>
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-600/30 border border-white/10 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white">
                              {(reply.author_name || 'A').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-bold text-white">{reply.author_name || 'Anonymous'}</span>
                                {reply.is_issue && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Issue
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-600">
                                  {reply.created_at ? formatDistanceToNow(new Date(reply.created_at), { addSuffix: true }) : ''}
                                </span>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    {!isResolved && (
                      <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                        <textarea
                          value={replyContent}
                          onChange={(e) => setReplyMap((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                          placeholder="Write a reply..."
                          rows={2}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition resize-none"
                        />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer select-none group">
                            <input
                              type="checkbox"
                              checked={isIssueMap[thread.id] || false}
                              onChange={(e) => setIsIssueMap((prev) => ({ ...prev, [thread.id]: e.target.checked }))}
                              className="rounded text-rose-500 bg-black/40 border-white/20 focus:ring-rose-500/30 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[10px] font-semibold text-gray-500 group-hover:text-rose-400 transition-colors">
                              Flag as issue
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleResolveThread(thread.id)}
                              className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg transition"
                            >
                              <CheckCircle className="w-3 h-3" /> Resolve
                            </button>
                            <button
                              onClick={() => handlePostReply(thread.id)}
                              disabled={!replyContent.trim() || postingReplyId === thread.id}
                              className="flex items-center gap-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition"
                            >
                              {postingReplyId === thread.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reopen if resolved */}
                    {isResolved && (
                      <div className="px-4 pb-3 flex justify-end">
                        <button
                          onClick={() => handleReopenThread(thread.id)}
                          className="text-[10px] font-bold text-gray-500 hover:text-white transition"
                        >
                          Reopen thread
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
