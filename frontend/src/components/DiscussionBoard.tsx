import React, { useState } from 'react';
import { MessageSquare, Send, AlertTriangle } from 'lucide-react';

interface Note {
  id: number;
  content: string;
  department: string;
  is_issue?: boolean;
  priority?: string;
  author_name?: string;
  created_at?: string;
}

interface DiscussionBoardProps {
  notes: Note[];
  onAddNote: (note: { content: string; department: string; is_issue: boolean; priority: string }) => Promise<void>;
  departmentKey: string;
  departmentName: string;
}

export default function DiscussionBoard({ notes, onAddNote, departmentKey, departmentName }: DiscussionBoardProps) {
  const [content, setContent] = useState('');
  const [isIssue, setIsIssue] = useState(false);
  const [priority, setPriority] = useState('Normal');
  const [posting, setPosting] = useState(false);

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      await onAddNote({
        content,
        department: departmentKey,
        is_issue: isIssue,
        priority: isIssue ? priority : 'Normal',
      });
      setContent('');
      setIsIssue(false);
      setPriority('Normal');
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-4">
        <h3 className="text-sm font-bold font-lexend text-white drop-shadow-md">Add Discussion Note / Log Issue</h3>
        <form onSubmit={handlePostNote} className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Share an update or report an issue regarding ${departmentName}...`}
            rows={3}
            className="w-full p-4 bg-black/40 border border-white/10 rounded-2xl text-xs text-white focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan focus:outline-none transition font-medium placeholder-gray-500 shadow-inner"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={isIssue}
                  onChange={(e) => setIsIssue(e.target.checked)}
                  className="w-4 h-4 rounded text-neon-cyan bg-black/40 border-white/20 focus:ring-neon-cyan focus:ring-offset-black transition-colors"
                />
                <span className="text-xs font-bold text-gray-400 group-hover:text-neon-cyan transition-colors">Flag as Site Issue</span>
              </label>

              {isIssue && (
                <div className="flex items-center space-x-2 animate-fade-in">
                  <span className="text-xs text-gray-500 font-semibold">Priority:</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="p-1.5 bg-black/60 border border-white/10 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-neon-cyan"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="px-5 py-3 bg-neon-cyan/20 hover:bg-neon-cyan text-neon-cyan hover:text-black border border-neon-cyan/50 font-extrabold rounded-xl text-xs shadow-[0_0_15px_rgba(0,243,255,0.2)] hover:shadow-[0_0_25px_rgba(0,243,255,0.6)] disabled:opacity-50 disabled:shadow-none hover:-translate-y-0.5 transition-all duration-300 active:scale-95 flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{posting ? 'Posting...' : 'Post Entry'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-inter">Discussion Feed</h4>
        {notes.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-10 text-center border border-dashed border-white/10 shadow-sm">
            <MessageSquare className="w-8 h-8 text-gray-600 drop-shadow-sm mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">No notes recorded for {departmentName} yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`bg-white/5 backdrop-blur-md rounded-3xl p-6 border shadow-[0_4px_15px_rgba(0,0,0,0.2)] transition ${
                  note.is_issue ? 'border-neon-pink/50 bg-neon-pink/5' : 'border-white/10'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-lexend text-white drop-shadow-sm">{note.author_name || 'Team Member'}</span>
                    <span className="text-xs text-gray-500">• {note.created_at ? new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                  </div>

                  {note.is_issue && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neon-pink/20 text-neon-pink border border-neon-pink/50 shadow-[0_0_10px_rgba(255,0,127,0.3)]">
                      <AlertTriangle className="w-3 h-3 mr-1" /> {note.priority || 'High'} Issue
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line font-medium">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
