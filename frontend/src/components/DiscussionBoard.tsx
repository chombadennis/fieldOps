import React from 'react';
import { MessageSquare, AlertTriangle } from 'lucide-react';
import DiscussionNoteInput from '@/components/DiscussionNoteInput';
import { renderSafeHtml } from '@/lib/sanitize';

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

  return (
    <div className="space-y-4">
      <DiscussionNoteInput 
        onAddNote={onAddNote}
        departmentKey={departmentKey}
        placeholder={`Share an update or report an issue regarding ${departmentName}...`}
      />

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

                <div 
                  className="text-xs text-gray-300 leading-relaxed font-medium note-content-html"
                  dangerouslySetInnerHTML={{ __html: renderSafeHtml(note.content) }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
