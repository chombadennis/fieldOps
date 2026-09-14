import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Loader2, AlertTriangle, ExternalLink, X, Unlink, Trash2, Eye, MessageCircle, History, RotateCw } from 'lucide-react';
import EmbeddedSheetEditor from '@/components/EmbeddedSheetEditor';
import { Integration } from './types';
import { getCurrentUser } from '@/services/api';

interface ActiveIntegrationsListProps {
  visibleIntegrations: Integration[];
  syncingId: number | null;
  deletingId: number | null;
  isLoading: boolean;
  outOfSyncMap: { [id: number]: boolean };
  newSheetsMap: { [id: number]: string[] };
  dismissedNewSheets: { [id: number]: boolean };
  syncResultMap: { [id: number]: { type: 'success' | 'error'; text: string } | null };
  activeEditorId: number | null;
  setActiveEditorId: (id: number | null) => void;
  handleOpenConfigForActive: (integration: any, preCheckSheetName?: string) => void;
  handleDismissAlert: (integrationId: number, sheetNames: string[]) => void;
  handleImportSheetClick: (integration: any, sheetName: string) => void;
  handleManualSync: (integrationId: number) => void;
  handleDisconnectClick: (integrationId: number) => void;
  handleDeleteClick?: (integration: Integration) => void;
  setSyncResultMap: React.Dispatch<React.SetStateAction<{ [id: number]: { type: 'success' | 'error'; text: string } | null }>>;
  syncingName: string;
  progressMessage: string;
}

export default function ActiveIntegrationsList({
  visibleIntegrations,
  syncingId,
  deletingId,
  isLoading,
  outOfSyncMap,
  newSheetsMap,
  dismissedNewSheets,
  syncResultMap,
  activeEditorId,
  setActiveEditorId,
  handleOpenConfigForActive,
  handleDismissAlert,
  handleImportSheetClick,
  handleManualSync,
  handleDisconnectClick,
  handleDeleteClick,
  setSyncResultMap,
  syncingName,
  progressMessage
}: ActiveIntegrationsListProps) {
  const renderSheetNames = (sheetNameJson: string) => {
    try {
      const parsed = JSON.parse(sheetNameJson);
      if (Array.isArray(parsed)) {
        return parsed.map((s: any) => s.name).join(', ');
      }
    } catch (e) { }
    return sheetNameJson;
  };

  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user)).catch(console.error);
  }, []);

  if (visibleIntegrations.length === 0) return null;

  return (
    <div className="bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl p-6 border border-white/10 transition-all duration-300">
      <h2 className="text-xl font-bold font-lexend text-white drop-shadow-md mb-4 flex items-center space-x-2">
        <span>Linked Workbooks</span>
        <span className="text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)] font-semibold px-2 py-0.5 rounded-full">
          {visibleIntegrations.length} Active
        </span>
      </h2>
      <div className="space-y-4">
        {visibleIntegrations.map((integration) => {
          const isGoogle = integration.provider === 'google_sheets';
          const isPreviewOnly = integration.preview_only;
          const validationScore = integration.validation_score;
          const validationIssues = integration.validation_issues;
          const isSyncing = syncingId === integration.id;

          const cardClass = isSyncing
            ? "border-neon-cyan/50 bg-neon-cyan/10 shadow-[0_0_15px_rgba(0,243,255,0.2)] animate-pulse"
            : isPreviewOnly
              ? "border-amber-500/50 bg-amber-500/10 hover:shadow-[0_4px_15px_rgba(0,0,0,0.3)]"
              : "border-white/10 bg-white/5 hover:border-neon-cyan/50 hover:bg-white/10 hover:shadow-[0_4px_15px_rgba(0,0,0,0.3)]";

          const iconClass = isSyncing
            ? "bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,243,255,0.5)] animate-spin"
            : isPreviewOnly
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
              : isGoogle
                ? "bg-emerald-900/200/20 text-emerald-400 border border-emerald-500/50"
                : "bg-neon-purple/20 text-neon-purple border border-neon-purple/50";

          return (
            <div key={integration.id} className="space-y-2">
              <div className={`rounded-xl p-5 border flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all duration-300 ${cardClass}`}>
                <div className="flex items-start space-x-4 min-w-0">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 transition-all duration-300 ${iconClass}`}>
                    {isSyncing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : isGoogle ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10H7v-2h10v2m0-4H7V7h10v2m0 8H7v-2h10v2z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-white text-sm truncate flex items-center space-x-2 flex-wrap gap-y-1">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/integrations/${integration.id}/open`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-white hover:text-neon-cyan transition-colors inline-flex items-center space-x-1 drop-shadow-md"
                        title={`Open in ${isGoogle ? 'Google Sheets' : 'Excel Online'}. Note: Ensure your browser is logged in to the account containing this file.`}
                      >
                        <span>{integration.boq_name || 'Spreadsheet BOQ'}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                      </a>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${isGoogle ? 'bg-emerald-900/200/20 text-emerald-400 border border-emerald-500/50' : 'bg-neon-purple/20 text-neon-purple border border-neon-purple/50'}`}>
                        {isGoogle ? 'Google Sheets' : 'OneDrive'}
                      </span>
                      {isPreviewOnly ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                          Preview Only
                        </span>
                      ) : null}
                      {outOfSyncMap[integration.id] && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)] animate-pulse">
                          <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                          Out of Sync (Edits in cloud)
                        </span>
                      )}
                    </h4>
                    {currentUser && integration.user_id === currentUser.id && integration.meta_data?.cloud_email && (
                      <p className="text-xs text-gray-400 mt-1 truncate"><span className="font-semibold text-slate-400">Source:</span> {integration.meta_data.cloud_email}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5 truncate"><span className="font-semibold text-slate-400">Worksheets:</span> {renderSheetNames(integration.sheet_name)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {isSyncing ? (
                        <span className="text-neon-cyan font-bold animate-pulse flex items-center space-x-1 text-xs">
                          <Loader2 className="w-3 h-3 animate-spin mr-1 text-neon-cyan" />
                          Sync in progress… updating database structure
                        </span>
                      ) : (
                        <>
                          Last Synced: {integration.last_synced_at ? new Date(integration.last_synced_at).toLocaleString() : 'Never'}
                          <span className="text-gray-300 mx-1.5">•</span>
                          <span
                            className="text-slate-400 font-medium cursor-help hover:text-indigo-600 transition-colors"
                            title={`Important: Ensure your web browser is signed in to the ${isGoogle ? 'Google' : 'Microsoft'} account containing this file, otherwise access will be denied.`}
                          >
                            Click name to edit in cloud (Login required)
                          </span>
                        </>
                      )}
                    </p>

                    {isPreviewOnly && !isSyncing && (
                      <div className="mt-3 bg-amber-50/40 border border-amber-100 rounded-xl p-3.5 max-w-xl">
                        {validationScore !== null && validationScore !== undefined && (
                          <div className="mb-1.5">
                            <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded border border-amber-200 inline-block">
                              Match Score: {Math.round(validationScore * 100)}%
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-amber-850 leading-relaxed mb-2">
                          This workbook is linked for <strong>read-only sheet preview</strong> because its structure does not match the database BoQ checklist.
                        </p>
                        {validationIssues && validationIssues.length > 0 && (
                          <ul className="space-y-1 pl-1">
                            {validationIssues.map((issue: string, i: number) => (
                              <li key={i} className="text-xs text-amber-900 flex items-start space-x-1.5">
                                <span className="font-extrabold text-amber-500 select-none mt-0.5">•</span>
                                <span>{issue}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {newSheetsMap[integration.id] && newSheetsMap[integration.id].length > 0 && (
                      <>
                        {!dismissedNewSheets[integration.id] ? (
                          <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-xs text-amber-800 flex items-start space-x-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <span className="font-semibold">New worksheets detected:</span> {newSheetsMap[integration.id].join(', ')}.
                              <div className="mt-2 flex space-x-2">
                                <button
                                  disabled={isLoading}
                                  onClick={() => handleOpenConfigForActive(integration)}
                                  className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-semibold py-1 px-2.5 rounded transition-colors disabled:opacity-50"
                                >
                                  Configure
                                </button>
                                <button
                                  disabled={isLoading}
                                  onClick={() => handleDismissAlert(integration.id, newSheetsMap[integration.id] || [])}
                                  className="text-[10px] bg-slate-900 border border-amber-200 hover:bg-amber-100 text-amber-900 font-semibold py-1 px-2.5 rounded transition-colors disabled:opacity-50"
                                >
                                  Clear Alert
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-xs space-y-2">
                            <span className="font-semibold text-slate-300 block">Available Worksheets (Not Imported):</span>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {newSheetsMap[integration.id].map((sheetName) => (
                                <div key={sheetName} className="flex items-center space-x-2 bg-slate-900 border border-slate-700/50 rounded-lg py-1 px-2.5 text-slate-300">
                                  <span className="font-mono text-xs">{sheetName}</span>
                                  <button
                                    disabled={isLoading}
                                    onClick={() => handleImportSheetClick(integration, sheetName)}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline disabled:opacity-50"
                                  >
                                    Import
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {(!currentUser || integration.user_id === currentUser.id) && (
                    <button
                      disabled={isLoading || syncingId !== null || deletingId !== null}
                      onClick={() => {
                        if (currentUser && integration.user_id !== currentUser.id) {
                          alert("You cannot inline preview because you are not the owner, but you can open the document in a new tab and request viewing access from the owner.");
                        } else {
                          setActiveEditorId(activeEditorId === integration.id ? null : integration.id);
                        }
                      }}
                      className={`py-2 px-3 border rounded-lg shadow-sm text-xs font-semibold flex items-center space-x-1.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${activeEditorId === integration.id
                        ? 'bg-neon-cyan border-neon-cyan text-black hover:bg-slate-900 shadow-[0_0_10px_rgba(0,243,255,0.5)]'
                        : 'border-white/20 hover:border-neon-cyan/50 text-gray-300 bg-black/40 hover:bg-neon-cyan/10 hover:text-neon-cyan'
                        }`}
                      title={activeEditorId === integration.id ? 'Hide inline spreadsheet preview' : 'Open inline spreadsheet preview'}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{activeEditorId === integration.id ? 'Hide Preview' : 'Inline Preview'}</span>
                    </button>
                  )}
                  <button
                    disabled={isLoading || syncingId !== null || deletingId !== null}
                    onClick={() => handleManualSync(integration.id)}
                    title={syncingId === integration.id ? `Syncing worksheets: ${syncingName}` : "Sync workbook data"}
                    className="py-2 px-3 border border-neon-purple/50 rounded-lg shadow-[0_0_8px_rgba(188,19,254,0.15)] text-xs font-semibold text-neon-purple bg-black/40 hover:bg-neon-purple/20 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
                  >
                    {syncingId === integration.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{syncingId === integration.id ? progressMessage : 'Sync Workbook'}</span>
                  </button>

                  {handleDeleteClick && (!currentUser || integration.user_id === currentUser.id) && (
                    <button
                      disabled={isLoading || syncingId !== null || deletingId !== null}
                      onClick={() => handleDeleteClick(integration)}
                      className="p-2 border border-red-500/50 rounded-lg text-red-400 bg-black/40 hover:bg-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.15)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete workbook data permanently from database"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Evolution feature action buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 pb-1">
                <button
                  disabled={isLoading || syncingId !== null || deletingId !== null}
                  onClick={() => alert("Discussion board is being initialized.")}
                  className="py-1.5 px-3 border rounded-lg bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 transition-colors flex items-center space-x-1.5 text-xs font-semibold shadow-sm"
                  title="Discuss Document"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Discuss</span>
                </button>

                <button
                  disabled={isLoading || syncingId !== null || deletingId !== null}
                  onClick={() => alert("Version history tracking is active in the background.")}
                  className="py-1.5 px-3 border rounded-lg bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20 transition-colors flex items-center space-x-1.5 text-xs font-semibold shadow-sm"
                  title="View Version History"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>History</span>
                </button>

                <button
                  disabled={isLoading || syncingId !== null || deletingId !== null}
                  onClick={() => alert("Supersede flow requires OAuth initialization.")}
                  className="py-1.5 px-3 border rounded-lg bg-neon-pink/10 border-neon-pink/30 text-neon-pink hover:bg-neon-pink/20 transition-colors flex items-center space-x-1.5 text-xs font-semibold shadow-sm"
                  title="Supersede with New Document"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Supersede</span>
                </button>
              </div>

              {/* Per-card sync result */}
              {syncResultMap[integration.id] && (
                <div className={`mt-1 rounded-xl px-4 py-3 flex items-start space-x-3 text-sm ${syncResultMap[integration.id]?.type === 'success'
                  ? 'bg-green-50 border border-green-100 text-green-800'
                  : 'bg-red-50 border border-red-100 text-red-800'
                  }`}>
                  {syncResultMap[integration.id]?.type === 'success' ? (
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="flex-1 text-xs font-semibold">{syncResultMap[integration.id]?.text}</p>
                  <button
                    onClick={() => setSyncResultMap(prev => ({ ...prev, [integration.id]: null }))}
                    className="text-gray-400 hover:text-slate-400 flex-shrink-0 ml-2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {activeEditorId === integration.id && (
                <div className="animate-fade-in">
                  <EmbeddedSheetEditor
                    integrationId={integration.id}
                    provider={integration.provider}
                    spreadsheetId={integration.spreadsheet_id}
                    boqName={integration.boq_name || undefined}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
