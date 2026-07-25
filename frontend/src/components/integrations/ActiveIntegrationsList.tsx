import React from 'react';
import { FileSpreadsheet, Loader2, AlertTriangle, ExternalLink, X, Unlink, Eye } from 'lucide-react';
import EmbeddedSheetEditor from '@/components/EmbeddedSheetEditor';
import { Integration } from './types';

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

  if (visibleIntegrations.length === 0) return null;

  return (
    <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100 transition-all duration-300">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
        <span>Linked Workbooks</span>
        <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
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
            ? "bg-gradient-to-r from-indigo-50/30 via-white to-indigo-50/10 border-indigo-200 shadow-sm animate-pulse"
            : isPreviewOnly
              ? "bg-gradient-to-br from-amber-50/10 to-white border-amber-100 hover:shadow-md"
              : "bg-gradient-to-br from-emerald-50/5 to-white border-emerald-100/70 hover:shadow-md";

          const iconClass = isSyncing
            ? "bg-indigo-100 text-indigo-600 animate-spin"
            : isPreviewOnly
              ? "bg-amber-50 text-amber-600 border border-amber-100"
              : isGoogle
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : "bg-indigo-50 text-indigo-600 border border-indigo-100";

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
                    <h4 className="font-bold text-gray-800 text-sm truncate flex items-center space-x-2 flex-wrap gap-y-1">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/integrations/${integration.id}/open`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-indigo-650 hover:text-indigo-850 transition-colors inline-flex items-center space-x-1"
                        title={`Open in ${isGoogle ? 'Google Sheets' : 'Excel Online'}. Note: Ensure your browser is logged in to the account containing this file.`}
                      >
                        <span>{integration.boq_name || 'Spreadsheet BOQ'}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                      </a>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${isGoogle ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                        {isGoogle ? 'Google Sheets' : 'OneDrive'}
                      </span>
                      {isPreviewOnly ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Preview Only
                        </span>
                      ) : null}
                      {outOfSyncMap[integration.id] && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                          <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                          Out of Sync (Edits in cloud)
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 truncate"><span className="font-semibold text-gray-600">File ID:</span> {integration.spreadsheet_id}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate"><span className="font-semibold text-gray-600">Worksheets:</span> {renderSheetNames(integration.sheet_name)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {isSyncing ? (
                        <span className="text-indigo-650 font-bold animate-pulse flex items-center space-x-1 text-xs">
                          <Loader2 className="w-3 h-3 animate-spin mr-1 text-indigo-500" />
                          Sync in progress… updating database structure
                        </span>
                      ) : (
                        <>
                          Last Synced: {integration.last_synced_at ? new Date(integration.last_synced_at).toLocaleString() : 'Never'}
                          <span className="text-gray-300 mx-1.5">•</span>
                          <span
                            className="text-gray-500 font-medium cursor-help hover:text-indigo-600 transition-colors"
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
                                  className="text-[10px] bg-white border border-amber-200 hover:bg-amber-100 text-amber-900 font-semibold py-1 px-2.5 rounded transition-colors disabled:opacity-50"
                                >
                                  Clear Alert
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-2">
                            <span className="font-semibold text-gray-700 block">Available Worksheets (Not Imported):</span>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {newSheetsMap[integration.id].map((sheetName) => (
                                <div key={sheetName} className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg py-1 px-2.5 text-gray-700">
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
                  <button
                    disabled={isLoading || syncingId !== null || deletingId !== null}
                    onClick={() => setActiveEditorId(activeEditorId === integration.id ? null : integration.id)}
                    className={`py-2 px-3 border rounded-lg shadow-sm text-xs font-semibold flex items-center space-x-1.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${activeEditorId === integration.id
                        ? 'bg-indigo-650 border-indigo-600 text-white bg-indigo-600 hover:bg-indigo-750'
                        : 'border-gray-205 border-gray-200 hover:border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    title={activeEditorId === integration.id ? 'Hide inline spreadsheet preview' : 'Open inline spreadsheet preview'}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{activeEditorId === integration.id ? 'Hide Preview' : 'Inline Preview'}</span>
                  </button>
                  <button
                    disabled={isLoading || syncingId !== null || deletingId !== null}
                    onClick={() => handleDisconnectClick(integration.id)}
                    className="p-2 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Disconnect spreadsheet"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                </div>
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
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2"
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
