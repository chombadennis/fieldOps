'use client';

import { useEffect, useState } from 'react';
import { getGoogleAuthUrl, getOneDriveAuthUrl, saveIntegration, triggerSyncImport, listCloudFiles, listCloudSheets, deleteIntegration, checkIntegrationUpdate, listActiveIntegrationSheets } from '@/services/api';
import { Folder, FileSpreadsheet, ChevronRight, ArrowLeft, Loader2, Trash2, AlertTriangle, ExternalLink, X, Unlink } from 'lucide-react';

interface Integration {
  id: number;
  provider: string;
  spreadsheet_id: string;
  sheet_name: string;
  boq_name: string | null;
  last_synced_at: string | null;
}

interface ProjectIntegrationsProps {
  projectId: string;
  integrations: Integration[];
  onRefresh: () => void;
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
}

export default function ProjectIntegrations({ projectId, integrations, onRefresh, globalLoading, setGlobalLoading }: ProjectIntegrationsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [outOfSyncMap, setOutOfSyncMap] = useState<{ [id: number]: boolean }>({});
  const [newSheetsMap, setNewSheetsMap] = useState<{ [id: number]: string[] }>({});
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [dismissedNewSheets, setDismissedNewSheets] = useState<{ [id: number]: boolean }>({});

  // Form states for linking spreadsheet after OAuth redirect callback
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [boqName, setBoqName] = useState('');
  const [sheetsList, setSheetsList] = useState<{ id: string; name: string; has_headers: boolean }[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<{ [id: string]: boolean }>({});
  const [fetchingSheets, setFetchingSheets] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<{ id: string; name: string; type: 'folder' | 'file' }[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);

  const [syncingId, setSyncingId] = useState<number | null>(null);
  const isLoading = loading || globalLoading;

  // Folder navigation states
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<{ id: string; name: string }[]>([]);

  // Fetch spreadsheets/folders when the OAuth setup completes or folder changes
  useEffect(() => {
    const loadFiles = async () => {
      if (oauthProvider && refreshToken && refreshToken !== 'existing') {
        setFetchingFiles(true);
        setError(null);
        try {
          const files = await listCloudFiles(oauthProvider, refreshToken, currentFolderId || undefined);
          setAvailableFiles(files);
        } catch (err) {
          setError('Failed to fetch files from drive.');
          console.error(err);
        } finally {
          setFetchingFiles(false);
        }
      }
    };
    loadFiles();
  }, [oauthProvider, refreshToken, currentFolderId]);

  // Check if spreadsheets are out of sync on load/refresh, and poll every 30 seconds
  useEffect(() => {
    const checkUpdates = async () => {
      const updates: { [id: number]: boolean } = {};
      const newSheets: { [id: number]: string[] } = {};
      for (const integration of integrations) {
        try {
          const res = await checkIntegrationUpdate(integration.id);
          updates[integration.id] = res.has_updates;
          newSheets[integration.id] = res.new_sheets || [];
        } catch (e) {
          console.error(`Failed to check updates for integration ${integration.id}:`, e);
        }
      }
      setOutOfSyncMap(updates);
      setNewSheetsMap(newSheets);
    };

    if (integrations.length > 0) {
      checkUpdates();
      
      // Poll remote spreadsheet updates every 30 seconds in the background
      const intervalId = setInterval(() => {
        checkUpdates();
      }, 30000);

      return () => clearInterval(intervalId);
    }
  }, [integrations]);

  // Fetch sheet names when a spreadsheet is selected
  useEffect(() => {
    const loadSheets = async () => {
      if (spreadsheetId && oauthProvider && refreshToken && refreshToken !== 'existing') {
        setFetchingSheets(true);
        setError(null);
        try {
          const sheets = await listCloudSheets({
            provider: oauthProvider,
            refresh_token: refreshToken,
            spreadsheet_id: spreadsheetId
          });
          setSheetsList(sheets);
          // Pre-check sheets that have headers
          const initialSelection: { [id: string]: boolean } = {};
          sheets.forEach((s: any) => {
            initialSelection[s.id] = s.has_headers;
          });
          setSelectedSheets(initialSelection);

          // Auto-populate BOQ Name if blank
          if (!boqName && availableFiles.length > 0) {
            const selectedFile = availableFiles.find(f => f.id === spreadsheetId);
            if (selectedFile) {
              const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
              setBoqName(nameWithoutExt);
            }
          }
        } catch (err: any) {
          console.error(err);
          setError(err.response?.data?.detail || 'Failed to fetch worksheets from the selected file.');
        } finally {
          setFetchingSheets(false);
        }
      } else {
        setSheetsList([]);
        setSelectedSheets({});
      }
    };
    loadSheets();
  }, [spreadsheetId, oauthProvider, refreshToken, availableFiles]);


  // Check URL parameters on mount to capture OAuth returns
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const provider = searchParams.get('oauth_provider');
      const token = searchParams.get('refresh_token');
      const err = searchParams.get('error');

      if (err) {
        setError(`OAuth Authorization Failed: ${decodeURIComponent(err)}`);
        // Clean URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (provider && token) {
        setOauthProvider(provider);
        setRefreshToken(token);
        setShowConfigModal(true);
        // Clean URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleFolderClick = (id: string, name: string) => {
    setNavigationHistory((prev) => [...prev, { id, name }]);
    setCurrentFolderId(id);
    setSpreadsheetId(''); // Reset selected file when moving into a subfolder
  };

  const handleNavigateBack = () => {
    setNavigationHistory((prev) => {
      const updated = prev.slice(0, -1);
      const parentFolder = updated[updated.length - 1];
      setCurrentFolderId(parentFolder ? parentFolder.id : null);
      return updated;
    });
    setSpreadsheetId('');
  };

  const handleCloseConfig = () => {
    setShowConfigModal(false);
    setCurrentFolderId(null);
    setNavigationHistory([]);
    setAvailableFiles([]);
    setSpreadsheetId('');
    setBoqName('');
    setSheetsList([]);
    setSelectedSheets({});
  };

  const handleOAuthInitiate = async (provider: 'google' | 'onedrive') => {
    setLoading(true);
    setError(null);
    try {
      if (provider === 'google') {
        const res = await getGoogleAuthUrl(projectId);
        window.location.href = res.url;
      } else {
        const res = await getOneDriveAuthUrl(projectId);
        window.location.href = res.url;
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to initiate ${provider} authentication flow.`);
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const checkedSheets = sheetsList.filter(s => selectedSheets[s.id]);
    if (!spreadsheetId.trim() || checkedSheets.length === 0 || !boqName.trim() || !oauthProvider || !refreshToken) {
      setError('Please fill in a BOQ name and select at least one worksheet.');
      return;
    }

    setLoading(true);
    setGlobalLoading(true);
    setError(null);
    try {
      const result = await saveIntegration({
        project_id: parseInt(projectId),
        provider: oauthProvider,
        spreadsheet_id: spreadsheetId.trim(),
        sheet_name: JSON.stringify(checkedSheets),
        refresh_token: refreshToken === 'existing' ? undefined : refreshToken,
        boq_name: boqName.trim(),
      });

      setSuccess('Spreadsheet linked successfully! Ingesting sheet data...');

      // Trigger initial pull import synchronously while keeping the modal open in loading state
      await triggerSyncImport(result.integration_id);

      setSuccess('Import complete!');
      
      // Close modal and refresh dashboard details after success message
      setTimeout(() => {
        setSuccess(null);
        handleCloseConfig();
        onRefresh();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError('Failed to link spreadsheet and trigger initial import.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleManualSync = async (integrationId: number) => {
    setSyncingId(integrationId);
    setLoading(true);
    setGlobalLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await triggerSyncImport(integrationId);
      setSuccess('Sync completed successfully!');
      onRefresh();
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError('Failed to trigger manual synchronization.');
    } finally {
      setSyncingId(null);
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleDisconnectClick = (integrationId: number) => {
    setDisconnectingId(integrationId);
  };

  const confirmDisconnect = async () => {
    if (disconnectingId === null) return;
    const id = disconnectingId;
    setDisconnectingId(null);
    setLoading(true);
    setGlobalLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteIntegration(id);
      setSuccess('Integration disconnected successfully.');
      onRefresh();
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError('Failed to disconnect integration.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleOpenConfigForActive = async (integration: any, preCheckSheetName?: string) => {
    setOauthProvider(integration.provider);
    setSpreadsheetId(integration.spreadsheet_id);
    setBoqName(integration.boq_name || '');
    setRefreshToken('existing');
    setShowConfigModal(true);
    setFetchingSheets(true);
    setError(null);
    try {
      const sheets = await listActiveIntegrationSheets(integration.id);
      setSheetsList(sheets);
      
      // Parse currently selected sheets
      let currentChecked: any[] = [];
      try {
        currentChecked = JSON.parse(integration.sheet_name);
      } catch (e) {}
      
      const selection: { [id: string]: boolean } = {};
      sheets.forEach((s: any) => {
        const isAlreadyLinked = currentChecked.some((cc: any) => cc.id === s.id || cc.name === s.name);
        const isClickedSheet = !!(preCheckSheetName && s.name === preCheckSheetName);
        selection[s.id] = isAlreadyLinked || isClickedSheet;
      });
      setSelectedSheets(selection);
    } catch (err) {
      setError('Failed to load worksheets for spreadsheet.');
      console.error(err);
    } finally {
      setFetchingSheets(false);
    }
  };

  const handleImportSheetClick = (integration: any, sheetName: string) => {
    if (window.confirm(`This sheet "${sheetName}" is not imported. Do you want to import it?`)) {
      handleOpenConfigForActive(integration, sheetName);
    }
  };

  const handleDismissAlert = (integrationId: number) => {
    setDismissedNewSheets((prev) => ({ ...prev, [integrationId]: true }));
  };

  const renderSheetNames = (sheetNameJson: string) => {
    try {
      const parsed = JSON.parse(sheetNameJson);
      if (Array.isArray(parsed)) {
        return parsed.map((s: any) => s.name).join(', ');
      }
    } catch (e) { }
    return sheetNameJson;
  };

  // Find active integrations
  const googleIntegration = integrations.find((i) => i.provider === 'google_sheets');
  const onedriveIntegration = integrations.find((i) => i.provider === 'onedrive');

  return (
    <div className="space-y-6">
      {/* Active Integrations list */}
      {integrations.length > 0 && (
        <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100 transition-all duration-300">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
            <span>Linked Workbooks</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
              {integrations.length} Active
            </span>
          </h2>
          <div className="space-y-4">
            {integrations.map((integration) => {
              const isGoogle = integration.provider === 'google_sheets';
              return (
                <div key={integration.id} className="bg-gray-50 rounded-xl p-5 border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start space-x-4 min-w-0">
                    {isGoogle ? (
                      <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 flex-shrink-0">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10H7v-2h10v2m0-4H7V7h10v2m0 8H7v-2h10v2z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 flex-shrink-0">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-800 text-sm truncate flex items-center space-x-2">
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/integrations/${integration.id}/open`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center space-x-1"
                          title={`Open in ${isGoogle ? 'Google Sheets' : 'Excel Online'}. Note: Ensure your browser is logged in to the account containing this file.`}
                        >
                          <span>{integration.boq_name || 'Spreadsheet BOQ'}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                        </a>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${isGoogle ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                          {isGoogle ? 'Google Sheets' : 'OneDrive'}
                        </span>
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
                        Last Synced: {integration.last_synced_at ? new Date(integration.last_synced_at).toLocaleString() : 'Never'}
                        <span className="text-gray-300 mx-1.5">•</span>
                        <span 
                          className="text-gray-500 font-medium cursor-help hover:text-indigo-600 transition-colors" 
                          title={`Important: Ensure your web browser is signed in to the ${isGoogle ? 'Google' : 'Microsoft'} account containing this file, otherwise access will be denied.`}
                        >
                          Click name to edit in cloud (Login required)
                        </span>
                      </p>

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
                                    onClick={() => handleDismissAlert(integration.id)}
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
                      disabled={isLoading}
                      onClick={() => handleManualSync(integration.id)}
                      className="py-2 px-4 border border-indigo-600 rounded-lg shadow-sm text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {syncingId === integration.id ? 'Syncing...' : 'Sync Workbook'}
                    </button>
                    <button
                      disabled={isLoading}
                      onClick={() => handleDisconnectClick(integration.id)}
                      className="p-2 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Disconnect spreadsheet"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Connect providers cards */}
      <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100 transition-all duration-300">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Cloud Integrations</h2>
          <p className="text-sm text-gray-500 mt-1">Connect your project database with live spreadsheets for bi-directional updates.</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6 text-sm animate-pulse">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-md mb-6 text-sm">
            {success}
          </div>
        )}

        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed mb-6">
          <div className="flex items-center space-x-2 text-amber-800 font-bold mb-1">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Spreadsheet Compatibility Requirements</span>
          </div>
          To sync successfully, your cloud spreadsheets must use standard BOQ structures (columns for <strong className="font-bold text-amber-950">Description, Qty, Rate, and Amount</strong>). Avoid connecting progress tracking spreadsheets, weighted task matrices, or draft scratchpads.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Google Sheets Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-5 border border-emerald-100 flex flex-col justify-between hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10H7v-2h10v2m0-4H7V7h10v2m0 8H7v-2h10v2z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-gray-800">Google Sheets</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Live syncing & tracking</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Connect and sync BOQs directly to a Google Sheets document. Supports automatic row additions and cell progress updates.
              </p>
            </div>

            <div className="pt-2">
              <button
                disabled={isLoading}
                onClick={() => handleOAuthInitiate('google')}
                className="w-full flex justify-center py-2 px-4 border border-emerald-600 rounded-lg shadow-sm text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect Google Sheets
              </button>
            </div>
          </div>

          {/* OneDrive Excel Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-5 border border-indigo-100 flex flex-col justify-between hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-gray-800">OneDrive Excel</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Live syncing & tracking</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Synchronize BOQ elements with Excel files on Microsoft OneDrive. Updates are tracked via MS Graph API hooks.
              </p>
            </div>

            <div className="pt-2">
              <button
                disabled={isLoading}
                onClick={() => handleOAuthInitiate('onedrive')}
                className="w-full flex justify-center py-2 px-4 border border-indigo-600 rounded-lg shadow-sm text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect OneDrive
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Config Modal after successful OAuth Callback */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold text-gray-800 mb-2 flex-shrink-0">Link Spreadsheet</h3>
            <p className="text-sm text-gray-500 mb-4 flex-shrink-0">
              Successfully authenticated with <span className="font-semibold capitalize text-gray-700">{oauthProvider?.replace('_', ' ')}</span>. Configure the sheet file mapping details below:
            </p>

            <form onSubmit={handleSaveConfig} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 min-h-0 pb-4">
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed">
                  <div className="flex items-center space-x-2 text-amber-800 font-bold mb-1">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Document Requirements</span>
                  </div>
                  FieldOps matches standard BOQ structures (columns for <strong className="font-bold text-amber-950">Description, Qty, Rate, and Amount</strong>). To prevent errors, select <strong className="font-bold text-amber-950">only</strong> costed bill sheets, and exclude progress templates, percentages, or calculation worksheets.
                </div>

                {refreshToken === 'existing' ? (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 flex items-center space-x-3 text-sm text-indigo-950">
                    <FileSpreadsheet className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                    <div>
                      <span className="block font-semibold text-xs text-indigo-500 uppercase tracking-wide">Linked Cloud Workbook</span>
                      <span className="font-bold text-gray-800">{boqName || 'Spreadsheet BOQ'}</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5 font-mono">File ID: {spreadsheetId}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-600 uppercase">Select Spreadsheet</label>
                      {navigationHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={handleNavigateBack}
                          className="flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          <span>Back</span>
                        </button>
                      )}
                    </div>

                    {/* Breadcrumbs Path */}
                    <div className="text-[11px] text-gray-400 truncate mb-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                      <span className="font-semibold text-gray-600">Path:</span> Home
                      {navigationHistory.map((folder) => (
                        <span key={folder.id}> / {folder.name}</span>
                      ))}
                    </div>

                    {fetchingFiles ? (
                      <div className="w-full h-48 border border-gray-200 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center text-gray-500 space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        <span className="text-xs font-medium">Scanning drive folder...</span>
                      </div>
                    ) : (
                      <div className="w-full h-48 border border-gray-200 rounded-xl overflow-y-auto divide-y divide-gray-100 bg-white">
                        {availableFiles.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-gray-400">
                            No folders or spreadsheet files found in this directory.
                          </div>
                        ) : (
                          availableFiles.map((file) => {
                            const isFolder = file.type === 'folder';
                            const isSelected = spreadsheetId === file.id;
                            return (
                              <div
                                key={file.id}
                                onClick={() =>
                                  isFolder
                                    ? handleFolderClick(file.id, file.name)
                                    : setSpreadsheetId(file.id)
                                }
                                className={`flex items-center justify-between p-3 cursor-pointer transition-all duration-150 ${isSelected
                                    ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-500'
                                    : 'hover:bg-gray-50 text-gray-700 font-medium'
                                  }`}
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  {isFolder ? (
                                    <Folder className="w-5 h-5 text-amber-500 fill-amber-100 flex-shrink-0" />
                                  ) : (
                                    <FileSpreadsheet className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-emerald-600' : 'text-gray-400'}`} />
                                  )}
                                  <span className="text-xs truncate">{file.name}</span>
                                </div>
                                {isFolder ? (
                                  <ChevronRight className="w-4 h-4 text-gray-400 hover:text-indigo-500" />
                                ) : isSelected ? (
                                  <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded-md uppercase">Selected</span>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                    {spreadsheetId && (
                      <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex items-center">
                        <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                        <span>Selected: {availableFiles.find((f) => f.id === spreadsheetId)?.name}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">BOQ Document Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Phase 1 BOQ"
                    value={boqName}
                    onChange={(e) => setBoqName(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Select Worksheets to Merge</label>
                  {fetchingSheets ? (
                    <div className="flex items-center space-x-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Pre-scanning worksheet structures...</span>
                    </div>
                  ) : sheetsList.length === 0 ? (
                    <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-gray-100">
                      Select a spreadsheet first to load its sheets.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                      {sheetsList.map((sheet) => (
                        <label key={sheet.id} className="flex items-start space-x-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-gray-100/70 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!selectedSheets[sheet.id]}
                            onChange={(e) =>
                              setSelectedSheets((prev) => ({
                                ...prev,
                                [sheet.id]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-gray-700 truncate block">{sheet.name}</span>
                            {sheet.has_headers ? (
                              <span className="text-[10px] text-emerald-600 font-medium">✓ Valid BOQ headers found</span>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-medium">⚠️ No headers found (Force check to import)</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100 flex-shrink-0 bg-white">
                <button
                  type="button"
                  onClick={handleCloseConfig}
                  className="flex-1 py-2.5 px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !spreadsheetId}
                  className="flex-1 py-2.5 px-4 border border-transparent rounded-lg text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Linking...' : 'Link & Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Custom Disconnect Confirmation Modal */}
      {disconnectingId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col relative animate-scale-up">
            <button
              onClick={() => setDisconnectingId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-50 rounded-xl text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Disconnect Spreadsheet</h3>
                <p className="text-xs text-gray-400">Syncing will be disabled</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Are you sure you want to disconnect this spreadsheet? This will stop automatic syncing, but your imported items will remain in the database.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setDisconnectingId(null)}
                className="flex-1 py-2.5 px-4 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-semibold text-gray-700 active:scale-[0.98] transition-all duration-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnect}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all duration-100"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
