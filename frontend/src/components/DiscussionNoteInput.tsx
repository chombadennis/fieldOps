import React, { useState, useRef } from 'react';
import { Send, AlertTriangle, List, ListOrdered, Indent } from 'lucide-react';
import { validateNoteContent } from '@/lib/sanitize';

interface DiscussionNoteInputProps {
  onAddNote: (note: { content: string; department: string; is_issue: boolean; priority: string }) => Promise<void>;
  departmentKey: string;
  placeholder?: string;
  variant?: 'dark' | 'light';
}

export default function DiscussionNoteInput({
  onAddNote,
  departmentKey,
  placeholder = "Share an update or log an issue...",
  variant = 'dark'
}: DiscussionNoteInputProps) {
  const [content, setContent] = useState('');
  const [isIssue, setIsIssue] = useState(false);
  const [priority, setPriority] = useState('Normal');
  const [posting, setPosting] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { isValid, wordCount, sanitized } = validateNoteContent(content);
  
  const isDark = variant === 'dark';
  const isButtonDisabled = posting || !isValid || !content.trim();
  
  // Theme classes
  const containerClass = isDark 
    ? "bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-4"
    : "bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 self-start";
    
  const headingClass = isDark
    ? "text-sm font-bold font-lexend text-white drop-shadow-md"
    : "text-xs font-extrabold uppercase tracking-wider text-gray-400 font-inter";
    
  const textareaClass = isDark
    ? "w-full p-4 bg-black/40 border border-white/10 rounded-2xl text-xs text-white focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan focus:outline-none transition font-medium placeholder-gray-500 shadow-inner resize-y min-h-[100px]"
    : "w-full p-4 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-medium text-gray-800 focus:ring-2 focus:ring-dark-teal-500/20 focus:border-dark-teal-500 focus:outline-none transition shadow-inner resize-y min-h-[100px]";
    
  const checkboxClass = isDark
    ? "w-4 h-4 rounded text-neon-cyan bg-black/40 border-white/20 focus:ring-neon-cyan focus:ring-offset-black transition-colors cursor-pointer"
    : "rounded text-dark-teal-600 focus:ring-dark-teal-500/20 w-4 h-4 border-gray-300 cursor-pointer";
    
  const checkboxLabelClass = isDark
    ? "text-xs font-bold text-gray-400 group-hover:text-neon-cyan transition-colors"
    : "text-xs font-semibold text-gray-600";
    
  const selectClass = isDark
    ? "p-1.5 bg-black/60 border border-white/10 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-neon-cyan"
    : "p-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-dark-teal-500";
    
  const buttonClass = isDark
    ? `px-5 py-3 font-extrabold rounded-xl text-xs flex items-center justify-center space-x-1.5 whitespace-nowrap transition-all duration-300 ${
        isButtonDisabled 
          ? 'bg-neon-cyan/5 text-neon-cyan/40 border border-neon-cyan/20 cursor-not-allowed opacity-60'
          : 'bg-neon-cyan/20 hover:bg-neon-cyan text-neon-cyan hover:text-black border border-neon-cyan/50 shadow-[0_0_15px_rgba(0,243,255,0.2)] hover:shadow-[0_0_25px_rgba(0,243,255,0.6)] hover:-translate-y-0.5 active:scale-95'
      }`
    : `w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
        isButtonDisabled
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
          : 'bg-dark-teal-900 hover:bg-black text-white shadow-md active:scale-95'
      }`;

  const toolbarBtnClass = isDark
    ? "p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
    : "p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors";

  const insertFormatting = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const isNumbering = prefix === '1. ';
    const isBullet = prefix === '- ';
    
    // Helper to find the previous number in a list
    const getPreviousNumber = (textBeforeCursor: string) => {
      const linesBefore = textBeforeCursor.split('\n');
      let lastNumber = 0;
      for (let i = linesBefore.length - 1; i >= 0; i--) {
        const line = linesBefore[i].trim();
        if (line === '') continue; 
        const match = line.match(/^(\d+)\./);
        if (match) {
          lastNumber = parseInt(match[1], 10);
          break;
        } else {
          break; // Stop at any non-empty, non-numbered line
        }
      }
      return lastNumber;
    };

    // Handle Text Selection
    if (start !== end) {
      const selectedText = text.substring(start, end);
      const lines = selectedText.split('\n');
      
      let newSelectedText = '';
      if (isNumbering) {
        const lastNumber = getPreviousNumber(text.substring(0, start));
        newSelectedText = lines.map((line, idx) => `${lastNumber + idx + 1}. ${line}`).join('\n');
      } else if (isBullet) {
        newSelectedText = lines.map((line) => `- ${line}`).join('\n');
      } else {
        // Generic prefix (e.g. indentation)
        newSelectedText = lines.map((line) => `${prefix}${line}`).join('\n');
      }
      
      const newText = text.substring(0, start) + newSelectedText + text.substring(end);
      setContent(newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + newSelectedText.length);
      }, 0);
      return;
    }
    
    // Handle Single Cursor
    let actualPrefix = prefix;
    if (isNumbering) {
      const lastNumber = getPreviousNumber(text.substring(0, start));
      actualPrefix = `${lastNumber + 1}. `;
    }
    
    // Check if we're at the start of a line
    const isStartOfLine = start === 0 || text[start - 1] === '\n';
    if (!isStartOfLine) {
      actualPrefix = `\n${actualPrefix}`;
    }

    const newText = text.substring(0, start) + actualPrefix + text.substring(end);
    setContent(newText);

    // Focus and move cursor after prefix
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + actualPrefix.length, start + actualPrefix.length);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter to submit
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlePostNote(e as any);
    }
    // Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      insertFormatting('    ');
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !content.trim() || posting) return;
    
    setPosting(true);
    try {
      await onAddNote({
        content: sanitized,
        department: departmentKey,
        is_issue: isIssue,
        priority: isIssue ? priority : 'Normal',
      });
      setContent('');
      setIsIssue(false);
      setPriority('Normal');
      setAlertInfo({ type: 'success', message: 'Note posted successfully!' });
    } catch (err: any) {
      console.error(err);
      const errorMsg = err.response?.data?.detail || err.message || 'An unknown error occurred.';
      setAlertInfo({ type: 'error', message: `Failed to post note: ${errorMsg}` });
    } finally {
      setPosting(false);
    }
  };

  // Word count color
  const wordCountColor = wordCount >= 500 
    ? 'text-red-500' 
    : wordCount >= 450 
      ? 'text-amber-500' 
      : isDark ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className={containerClass}>
      <h3 className={headingClass}>Add Discussion Note / Log Issue</h3>
      <form onSubmit={handlePostNote} className="space-y-3">
        <div className="space-y-2">
          {/* Toolbar */}
          <div className="flex items-center space-x-1 px-1">
            <button 
              type="button" 
              onClick={() => insertFormatting('- ')} 
              className={toolbarBtnClass}
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              type="button" 
              onClick={() => insertFormatting('1. ')} 
              className={toolbarBtnClass}
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <div className={`w-px h-4 mx-1 ${isDark ? 'bg-white/20' : 'bg-gray-300'}`} />
            <button 
              type="button" 
              onClick={() => insertFormatting('    ')} 
              className={toolbarBtnClass}
              title="Indent (Tab)"
            >
              <Indent className="w-4 h-4" />
            </button>
            <div className="flex-grow"></div>
            <span className={`text-[10px] font-medium ${wordCountColor}`}>
              {wordCount} / 500 words
            </span>
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={4}
            className={textareaClass}
          />
        </div>

        <div className={`flex ${isDark ? 'flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1' : 'flex-col items-center justify-between gap-4'}`}>
          <div className={`flex items-center ${isDark ? 'space-x-6' : 'justify-between w-full'}`}>
            <label className="flex items-center space-x-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={isIssue}
                onChange={(e) => setIsIssue(e.target.checked)}
                className={checkboxClass}
              />
              <span className={checkboxLabelClass}>Flag as Issue</span>
            </label>

            {isIssue && (
              <div className={`flex items-center space-x-2 animate-fade-in ${!isDark ? 'ml-auto' : ''}`}>
                <span className={`text-xs font-semibold ${isDark ? 'text-gray-500' : ''}`}>Priority:</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={selectClass}
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
            disabled={isButtonDisabled}
            className={buttonClass}
          >
            {posting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Post Entry</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Custom Alert Modal */}
      {alertInfo && (
        <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#030305] rounded-3xl p-6 max-w-sm w-full shadow-[0_0_50px_rgba(255,255,255,0.1)] animate-fade-in text-center border border-white/10">
            {alertInfo.type === 'error' ? (
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-neon-cyan/20 flex items-center justify-center mx-auto mb-4 border border-neon-cyan/50 shadow-[0_0_15px_rgba(0,243,255,0.3)]">
                <svg className="w-6 h-6 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
            )}
            <h3 className="text-lg font-bold font-lexend text-white mb-2">
              {alertInfo.type === 'error' ? 'Error' : 'Success'}
            </h3>
            <p className="text-sm text-gray-400 font-medium mb-6">{alertInfo.message}</p>
            <button
              onClick={() => setAlertInfo(null)}
              className={`w-full font-bold py-3 px-4 rounded-xl transition shadow-lg ${
                alertInfo.type === 'error'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white'
                  : 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.2)]'
              }`}
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
