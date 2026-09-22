'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProjectTasks, createProjectTask, updateProjectTask, deleteProjectTask, getTeamMembers } from '@/services/api';
import {
  CheckSquare, Plus, X, Loader2, Calendar, User,
  AlertCircle, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';

interface TaskListProps {
  projectId: number;
  module: string;
  documents?: any[];
}

interface Task {
  id: number;
  title: string;
  description?: string;
  assigned_to_name?: string;
  due_date?: string;
  priority: string;
  status: string;
  resolution_note?: string;
  created_at?: string;
  thread_id?: number;
  linked_document_ids?: number[];
}

const PRIORITY_STYLES: Record<string, string> = {
  Low: 'text-gray-400  bg-gray-500/10  border-gray-500/20',
  Normal: 'text-blue-400  bg-blue-500/10  border-blue-500/20',
  High: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Critical: 'text-rose-400  bg-rose-500/10  border-rose-500/20',
};

const STATUS_STYLES: Record<string, string> = {
  Open: 'text-gray-400  bg-gray-500/10  border-gray-500/20',
  'In Progress': 'text-blue-400  bg-blue-500/10  border-blue-500/20',
  Blocked: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Done: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Failed: 'text-rose-400  bg-rose-500/10  border-rose-500/20',
};

const AUTHOR_NAME = 'You';

export default function TaskList({ projectId, module, documents = [] }: TaskListProps) {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', assigned_to_name: '', due_date: '', priority: 'Normal',
  });
  const [linkedDocIds, setLinkedDocIds] = useState<number[]>([]);
  const [posting, setPosting] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [failReasonMap, setFailReasonMap] = useState<Record<number, string>>({});
  const [showFailPrompt, setShowFailPrompt] = useState<number | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', projectId, module],
    queryFn: () => getProjectTasks(projectId, module),
    enabled: !!projectId,
  });

  const { data: team = [] } = useQuery({
    queryKey: ['team', projectId],
    queryFn: () => getTeamMembers(projectId),
    enabled: !!projectId,
  });

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setPosting(true);
    try {
      let assignedName = '';
      if (form.assigned_to_name && form.assigned_to_name !== 'unassigned') {
        const member = team.find((t: any) => String(t.id) === form.assigned_to_name);
        if (member) {
          assignedName = member.name;
        }
      }

      await createProjectTask(projectId, {
        title: form.title.trim(),
        description: form.description || undefined,
        module,
        assigned_to_id: form.assigned_to_name && form.assigned_to_name !== 'unassigned' ? parseInt(form.assigned_to_name) : undefined,
        assigned_to_name: assignedName || undefined,
        due_date: form.due_date || undefined,
        priority: form.priority,
        created_by_name: AUTHOR_NAME,
        linked_document_ids: linkedDocIds.length > 0 ? linkedDocIds : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId, module] });
      setForm({ title: '', description: '', assigned_to_name: '', due_date: '', priority: 'Normal' });
      setLinkedDocIds([]);
      setShowNew(false);
    } finally {
      setPosting(false);
    }
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    if (newStatus === 'Failed') {
      setShowFailPrompt(task.id);
      return;
    }
    setUpdatingId(task.id);
    try {
      await updateProjectTask(projectId, task.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId, module] });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmFail = async (taskId: number) => {
    const reason = failReasonMap[taskId];
    if (!reason?.trim()) return;
    setUpdatingId(taskId);
    try {
      await updateProjectTask(projectId, taskId, { status: 'Failed', resolution_note: reason });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId, module] });
      setShowFailPrompt(null);
      setFailReasonMap((prev) => ({ ...prev, [taskId]: '' }));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm('Delete this task?')) return;
    await deleteProjectTask(projectId, taskId);
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId, module] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
      </div>
    );
  }

  const openTasks = (tasks as Task[]).filter((t) => !['Done', 'Failed'].includes(t.status));
  const closedTasks = (tasks as Task[]).filter((t) => ['Done', 'Failed'].includes(t.status));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {openTasks.length} open · {closedTasks.length} closed
        </p>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-xl transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          New Task
        </button>
      </div>

      {/* New Task Form */}
      {showNew && (
        <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-blue-300">Create task</h4>
            <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Task title (required)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60 transition"
          />
          <textarea
            placeholder="Description (optional)..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60 transition resize-none"
          />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assign To</label>
              <select
                value={form.assigned_to_name}
                onChange={(e) => setForm({ ...form, assigned_to_name: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/60 transition appearance-none cursor-pointer"
              >
                <option value="unassigned" className="bg-gray-900 text-white">Unassigned</option>
                {team.map((member: any) => (
                  <option key={member.id} value={member.id} className="bg-gray-900 text-white">{member.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/60 transition appearance-none cursor-pointer"
              >
                <option className="bg-gray-900 text-white">Low</option>
                <option className="bg-gray-900 text-white">Normal</option>
                <option className="bg-gray-900 text-white">High</option>
                <option value="Critical" className="bg-gray-900 text-white">Critical</option>
              </select>
            </div>
          </div>
          {documents.length > 0 && (
            <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-2 mt-3">
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
                      className={`px-2.5 py-1 text-[10px] rounded-lg border transition-all ${isSelected
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
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
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/60 transition"
          />
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowNew(false)} className="text-xs font-semibold text-gray-500 hover:text-white transition">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={posting || !form.title.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
              Create Task
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      {tasks.length === 0 && !showNew ? (
        <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
          <CheckSquare className="w-7 h-7 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-medium">No tasks yet. Create one to track work.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(tasks as Task[]).map((task) => {
            const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !['Done', 'Failed'].includes(task.status);
            const isDone = task.status === 'Done';
            const isFailed = task.status === 'Failed';
            const isExpanded = expandedId === task.id;

            return (
              <div key={task.id} className={`rounded-2xl border transition-all overflow-hidden ${isDone ? 'border-emerald-500/10 bg-white/[0.02]' :
                  isFailed ? 'border-rose-500/10 bg-white/[0.02]' :
                    isOverdue ? 'border-amber-500/20 bg-amber-500/5' :
                      'border-white/10 bg-white/[0.04] hover:border-white/20'
                }`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {isDone && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    {isFailed && <XCircle className="w-4 h-4 text-rose-500" />}
                    {!isDone && !isFailed && (
                      <div className={`w-4 h-4 rounded-full border-2 ${task.status === 'In Progress' ? 'border-blue-400' :
                          task.status === 'Blocked' ? 'border-amber-400' : 'border-gray-500'
                        }`} />
                    )}
                  </div>

                  {/* Title + Meta */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isDone || isFailed ? 'line-through text-gray-500' : 'text-white'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {task.assigned_to_name && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                          <User className="w-2.5 h-2.5" /> {task.assigned_to_name}
                        </span>
                      )}
                      {task.due_date && (
                        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isOverdue ? 'text-amber-400' : 'text-gray-500'}`}>
                          {isOverdue ? <AlertCircle className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
                          {format(parseISO(task.due_date), 'MMM dd')}
                        </span>
                      )}
                    </div>
                    {/* Referenced Documents Display */}
                    {task.linked_document_ids && task.linked_document_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {task.linked_document_ids.map(id => {
                          const doc = documents.find(d => d.id === id);
                          if (!doc) return null;
                          return (
                            <span key={id} className="text-[9px] bg-blue-500/20 border border-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded flex items-center max-w-[150px] truncate">
                              {doc.title || doc.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Priority + Status badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Normal}`}>
                      {task.priority}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLES[task.status] || STATUS_STYLES.Open}`}>
                      {task.status}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-white/5 px-4 py-3 space-y-3">
                    {task.description && (
                      <p className="text-xs text-gray-400 leading-relaxed">{task.description}</p>
                    )}
                    {task.resolution_note && (
                      <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl px-3 py-2">
                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Resolution Note</p>
                        <p className="text-xs text-gray-400">{task.resolution_note}</p>
                      </div>
                    )}

                    {/* Fail Reason prompt */}
                    {showFailPrompt === task.id && (
                      <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3 space-y-2 animate-fade-in">
                        <p className="text-[10px] font-bold text-rose-400">Why did this fail? (required)</p>
                        <textarea
                          rows={2}
                          value={failReasonMap[task.id] || ''}
                          onChange={(e) => setFailReasonMap((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          placeholder="Briefly describe why this task failed..."
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/50 transition resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setShowFailPrompt(null)} className="text-xs text-gray-500 hover:text-white transition">Cancel</button>
                          <button
                            onClick={() => handleConfirmFail(task.id)}
                            disabled={!failReasonMap[task.id]?.trim() || updatingId === task.id}
                            className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                          >
                            {updatingId === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm Failed'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!['Done', 'Failed'].includes(task.status) && showFailPrompt !== task.id && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {(['Open', 'In Progress', 'Blocked'] as const).map((s) => s !== task.status && (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(task, s)}
                            disabled={updatingId === task.id}
                            className="text-[10px] font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-lg transition disabled:opacity-40"
                          >
                            → {s}
                          </button>
                        ))}
                        <button
                          onClick={() => handleStatusChange(task, 'Done')}
                          disabled={updatingId === task.id}
                          className="text-[10px] font-bold text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition disabled:opacity-40 flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" /> Done
                        </button>
                        <button
                          onClick={() => setShowFailPrompt(task.id)}
                          disabled={updatingId === task.id}
                          className="text-[10px] font-bold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 px-2.5 py-1 rounded-lg transition disabled:opacity-40 flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> Failed
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="text-[10px] font-bold text-gray-600 hover:text-rose-400 ml-auto transition"
                        >
                          Delete
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
