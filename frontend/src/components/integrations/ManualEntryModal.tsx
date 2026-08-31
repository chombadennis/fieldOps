import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Table2, Settings2, Layers, FileText } from 'lucide-react';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, payload: any) => Promise<void>;
  isLoading: boolean;
  departmentKey: string;
  departmentName?: string;
}

interface Section {
  id: string;
  title: string;
  columns: string[];
  rows: Record<string, string>[];
  isEditColumns: boolean;
}

interface Template {
  name: string; // This will map to departmentKey
  sections: { title: string; columns: string[] }[];
}

const PREDEFINED_TEMPLATES: Template[] = [
  {
    name: 'field_ops_dpr',
    sections: [
      { title: 'Weather', columns: ['Morning', 'Afternoon', 'Evening'] },
      { title: 'Activities', columns: ['Item', 'Description', 'Quantity', 'Unit'] }
    ]
  },
  {
    name: 'field_ops_jms',
    sections: [{ title: 'Measurements', columns: ['Item Description', 'Grid/Location', 'Length', 'Width', 'Depth', 'Volume'] }]
  },
  {
    name: 'field_ops_grn',
    sections: [{ title: 'Deliveries', columns: ['Material', 'Supplier', 'Ticket No.', 'Quantity', 'Unit'] }]
  },
  {
    name: 'field_ops_timesheets',
    sections: [{ title: 'Logs', columns: ['Name', 'Trade/Equipment', 'Regular Hrs', 'Overtime'] }]
  }
];

export default function ManualEntryModal({ isOpen, onClose, onSave, isLoading, departmentKey, departmentName }: ManualEntryModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  
  const [sections, setSections] = useState<Section[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      
      const stored = localStorage.getItem('fieldops_custom_templates');
      let customTpls: Template[] = [];
      if (stored) {
        try { customTpls = JSON.parse(stored); } catch (e) {}
      }
      setSavedTemplates(customTpls);

      const allTemplates = [...PREDEFINED_TEMPLATES, ...customTpls];
      const tpl = allTemplates.find(t => t.name === departmentKey);

      if (tpl) {
        setSections(tpl.sections.map(s => ({
          id: Math.random().toString(),
          title: s.title,
          columns: s.columns,
          rows: [{}],
          isEditColumns: false
        })));
      } else {
        // Fallback for brand new custom modules
        setSections([{
          id: Math.random().toString(),
          title: 'Section 1',
          columns: ['Item', 'Quantity', 'Unit'],
          rows: [{}],
          isEditColumns: false
        }]);
      }
    }
  }, [isOpen, departmentKey]);

  if (!isOpen) return null;

  const handleAddSection = () => {
    setSections([...sections, {
      id: Date.now().toString(),
      title: `Section ${sections.length + 1}`,
      columns: ['Item', 'Quantity', 'Unit'],
      rows: [{}],
      isEditColumns: false
    }]);
  };

  const handleRemoveSection = (sectionId: string) => {
    setSections(sections.filter(s => s.id !== sectionId));
  };

  const updateSection = (sectionId: string, updater: (sec: Section) => Section) => {
    setSections(sections.map(s => s.id === sectionId ? updater(s) : s));
  };

  const handleSectionTitleChange = (sectionId: string, newTitle: string) => {
    updateSection(sectionId, s => ({ ...s, title: newTitle }));
  };

  const handleToggleEditColumns = (sectionId: string) => {
    updateSection(sectionId, s => ({ ...s, isEditColumns: !s.isEditColumns }));
  };

  const handleAddColumn = (sectionId: string) => {
    updateSection(sectionId, s => ({ ...s, columns: [...s.columns, `Column ${s.columns.length + 1}`] }));
  };

  const handleRemoveColumn = (sectionId: string, idx: number) => {
    updateSection(sectionId, s => {
      const colToRemove = s.columns[idx];
      const newCols = [...s.columns];
      newCols.splice(idx, 1);
      
      const newRows = s.rows.map(row => {
        const newRow = { ...row };
        delete newRow[colToRemove];
        return newRow;
      });
      
      return { ...s, columns: newCols, rows: newRows };
    });
  };

  const handleColumnNameChange = (sectionId: string, idx: number, newName: string) => {
    updateSection(sectionId, s => {
      const oldName = s.columns[idx];
      if (newName === oldName || !newName.trim() || s.columns.includes(newName)) return s;
      
      const newCols = [...s.columns];
      newCols[idx] = newName;
      
      const newRows = s.rows.map(row => {
        const newRow = { ...row };
        if (oldName in newRow) {
          newRow[newName] = newRow[oldName];
          delete newRow[oldName];
        }
        return newRow;
      });
      
      return { ...s, columns: newCols, rows: newRows };
    });
  };

  const handleAddRow = (sectionId: string) => {
    updateSection(sectionId, s => ({ ...s, rows: [...s.rows, {}] }));
  };

  const handleRemoveRow = (sectionId: string, rowIdx: number) => {
    updateSection(sectionId, s => {
      const newRows = [...s.rows];
      newRows.splice(rowIdx, 1);
      return { ...s, rows: newRows };
    });
  };

  const handleCellChange = (sectionId: string, rowIdx: number, colName: string, value: string) => {
    updateSection(sectionId, s => {
      const newRows = [...s.rows];
      newRows[rowIdx] = { ...newRows[rowIdx], [colName]: value };
      return { ...s, rows: newRows };
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Please enter a Document Title.");
      return;
    }
    if (sections.length === 0) {
      alert("Please define at least one section.");
      return;
    }

    if (saveAsTemplate) {
      const newTemplate: Template = {
        name: departmentKey, // Save strictly against the departmentKey
        sections: sections.map(s => ({ title: s.title, columns: s.columns }))
      };
      const updatedTpls = [...savedTemplates.filter(t => t.name !== departmentKey), newTemplate];
      localStorage.setItem('fieldops_custom_templates', JSON.stringify(updatedTpls));
      setSavedTemplates(updatedTpls);
    }

    const payloadSections = sections.map(s => {
      const validRows = s.rows.filter(row => Object.values(row).some(val => val && val.toString().trim() !== ''));
      return {
        title: s.title,
        columns: s.columns,
        rows: validRows
      };
    }).filter(s => s.columns.length > 0);

    const payload = {
      date,
      description,
      sections: payloadSections
    };

    await onSave(title, payload);
    setTitle('');
    setDescription('');
    setSaveAsTemplate(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030305]/80 backdrop-blur-md p-4">
      <div className="bg-[#030305] border border-white/10 rounded-3xl w-full max-w-[95vw] xl:max-w-7xl h-[95vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-fade-in-up overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold font-lexend text-white flex items-center drop-shadow-md">
              <Table2 className="w-5 h-5 mr-2 text-neon-pink" />
              {departmentName || 'Custom'} Workbook Builder
            </h3>
            <p className="text-xs text-gray-400 mt-1">Design multi-section tables for the {departmentName || 'current'} module.</p>
          </div>
          <button onClick={onClose} disabled={isLoading} className="text-gray-500 hover:text-white active:scale-95 transition-all duration-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col p-6 space-y-8 bg-transparent">
          
          {/* Metadata Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 border border-white/10 p-5 rounded-2xl shadow-sm flex-shrink-0">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Document Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g., ${departmentName || 'Custom'} Document`}
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:bg-black focus:ring-2 focus:ring-neon-pink focus:border-neon-pink text-sm outline-none transition font-medium"
                />
              </div>
              <div className="pt-2">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 rounded text-neon-pink border-white/20 bg-black/50 focus:ring-neon-pink focus:ring-offset-0"
                  />
                  <span className="text-xs font-bold text-gray-300">Save layout as the default template for this module</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Date</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white focus:bg-black focus:ring-2 focus:ring-neon-pink focus:border-neon-pink text-sm outline-none font-medium" 
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-300">Description / General Notes</label>
                  <span className={`text-[10px] font-bold ${description.trim().split(/\\s+/).filter(Boolean).length >= 500 ? 'text-red-500' : 'text-gray-400'}`}>
                    {description.trim() === '' ? 0 : description.trim().split(/\\s+/).filter(Boolean).length} / 500 words
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => {
                    const val = e.target.value;
                    const wordCount = val.trim() === '' ? 0 : val.trim().split(/\\s+/).filter(Boolean).length;
                    if (wordCount <= 500 || val.length < description.length) {
                      setDescription(val);
                    }
                  }}
                  placeholder="Add any general context or conditions..."
                  rows={5}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:bg-black focus:ring-2 focus:ring-neon-pink focus:border-neon-pink text-sm outline-none transition font-medium resize-y"
                />
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-8 pb-10">
            {sections.map((section) => (
              <div key={section.id} className="flex flex-col bg-white/5 border border-white/10 rounded-2xl shadow-sm overflow-hidden">
                
                {/* Section Header Toolbar */}
                <div className="bg-black/40 px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center space-x-3 w-1/2">
                    <Layers className="w-5 h-5 text-neon-pink" />
                    <input 
                      type="text" 
                      value={section.title}
                      onChange={(e) => handleSectionTitleChange(section.id, e.target.value)}
                      placeholder={`Section Title (e.g., ${departmentName || 'Custom'} Data)`}
                      className="flex-1 bg-black/40 px-3 py-1.5 border border-white/20 rounded-lg text-sm font-bold text-white placeholder-gray-600 focus:ring-2 focus:ring-neon-pink outline-none"
                    />
                  </div>
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => handleToggleEditColumns(section.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center transition-colors ${
                        section.isEditColumns ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/30 shadow-sm' : 'bg-white/5 text-gray-300 border border-white/10 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                      {section.isEditColumns ? 'Done Editing Columns' : 'Edit Columns'}
                    </button>
                    <button 
                      onClick={() => handleRemoveSection(section.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Delete Section"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Column Editor Panel */}
                {section.isEditColumns && (
                  <div className="bg-black/60 p-5 border-b border-white/10">
                    <p className="text-xs text-neon-pink font-bold mb-3 uppercase tracking-wider">Define Columns for '{section.title || 'this section'}'</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {section.columns.map((col, idx) => (
                        <div key={idx} className="flex items-center bg-black/40 border border-white/10 rounded-lg overflow-hidden shadow-sm">
                          <input 
                            type="text" 
                            value={col}
                            onChange={(e) => handleColumnNameChange(section.id, idx, e.target.value)}
                            className="px-3 py-1.5 text-sm font-bold text-white bg-transparent w-32 outline-none"
                          />
                          <button 
                            onClick={() => handleRemoveColumn(section.id, idx)}
                            className="px-2.5 py-2 text-gray-500 hover:text-red-400 hover:bg-red-500/20 transition-colors border-l border-white/10"
                            title="Remove Column"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => handleAddColumn(section.id)}
                        className="flex items-center text-xs font-bold text-neon-pink bg-white/5 border border-white/20 border-dashed px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Column
                      </button>
                    </div>
                  </div>
                )}

                {/* Data Grid */}
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-full">
                    <thead>
                      <tr className="bg-black/60 border-b border-white/10">
                        <th className="w-12 px-2 py-3 text-center text-[10px] font-black text-gray-500 uppercase sticky left-0 bg-black/60 z-10 border-r border-white/10">#</th>
                        {section.columns.map((col, idx) => (
                          <th key={idx} className="px-4 py-3 text-xs font-black text-gray-300 border-r border-white/10 whitespace-nowrap min-w-[120px]">
                            {col}
                          </th>
                        ))}
                        <th className="w-12 px-2 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-white/5 hover:bg-white/5 group transition-colors">
                          <td className="px-2 py-2 text-center text-xs font-bold text-gray-500 sticky left-0 bg-[#030305] group-hover:bg-white/5 border-r border-white/5 z-10">
                            {rowIndex + 1}
                          </td>
                          {section.columns.map((col, colIndex) => (
                            <td key={colIndex} className="px-1 py-1 border-r border-white/5 relative">
                              <input 
                                type="text"
                                value={row[col] || ''}
                                onChange={(e) => handleCellChange(section.id, rowIndex, col, e.target.value)}
                                placeholder="-"
                                className="w-full px-3 py-2 text-sm text-white placeholder-gray-600 bg-transparent outline-none focus:bg-black/40 focus:ring-1 focus:ring-neon-pink rounded-md transition-colors"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1 text-center">
                            <button 
                              onClick={() => handleRemoveRow(section.id, rowIndex)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {section.rows.length === 0 && (
                        <tr>
                          <td colSpan={section.columns.length + 2} className="px-4 py-8 text-center text-gray-400 text-sm italic">
                            No rows added in this section.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Table Footer */}
                <div className="bg-black/40 border-t border-white/10 px-4 py-3">
                   <button 
                      onClick={() => handleAddRow(section.id)}
                      className="flex items-center text-xs font-bold text-neon-pink hover:text-neon-pink/80 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Row to {section.title || 'Section'}
                    </button>
                </div>
              </div>
            ))}

            <button 
              onClick={handleAddSection}
              className="w-full py-4 border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 text-neon-pink font-bold rounded-2xl transition-colors flex items-center justify-center text-sm shadow-sm"
            >
              <Layers className="w-5 h-5 mr-2" />
              Add New Section
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-white/10 bg-[#030305] rounded-b-3xl flex justify-end items-center flex-shrink-0">
          <div className="flex space-x-3">
            <button 
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-bold text-gray-300 bg-transparent border border-white/10 rounded-xl hover:bg-white/5 transition shadow-sm"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-bold text-white bg-neon-pink rounded-xl hover:bg-neon-pink/90 shadow-[0_0_15px_rgba(255,0,127,0.5)] transition flex items-center"
            >
              {isLoading ? 'Saving...' : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Workbook
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
