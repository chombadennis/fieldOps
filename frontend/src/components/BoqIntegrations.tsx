'use client';

import { useEffect, useState } from 'react';
import { getGoogleAuthUrl, getOneDriveAuthUrl, saveIntegration, triggerSyncImport, listCloudFiles, listCloudSheets, deleteIntegration, checkIntegrationUpdate, listActiveIntegrationSheets, dismissIntegrationSheets, createProjectDocument, convertGoogleCloudFile, getGlobalAuthToken } from '@/services/api';
import { Folder, FileSpreadsheet, ChevronRight, ArrowLeft, Loader2, Trash2, AlertTriangle, ExternalLink, X, Unlink, Eye, Sparkles, Paperclip, RefreshCw, Link2, Layers, Lock } from 'lucide-react';
import EmbeddedSheetEditor from '@/components/EmbeddedSheetEditor';
import CloudConnectionCards from './integrations/CloudConnectionCards';


interface Integration {
  id: number;
  provider: string;
  spreadsheet_id: string;
  sheet_name: string;
  boq_name: string | null;
  last_synced_at: string | null;
  preview_only?: boolean;
  validation_status?: string | null;
  validation_score?: number | null;
  validation_issues?: string[] | null;
  validation_summary?: string | null;
  module?: string;
}

interface BoqIntegrationsProps {
  projectId: string | number;
  integrations: Integration[];
  boqDocuments: any[];
  documents?: any[];
  onRefresh: () => void;
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
}

export default function BoqIntegrations({
  projectId,
  integrations,
  boqDocuments = [],
  documents = [],
  onRefresh,
  globalLoading,
  setGlobalLoading,
}: BoqIntegrationsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [outOfSyncMap, setOutOfSyncMap] = useState<{ [id: number]: boolean }>({});
  const [newSheetsMap, setNewSheetsMap] = useState<{ [id: number]: string[] }>({});
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [dismissedNewSheets, setDismissedNewSheets] = useState<{ [id: number]: boolean }>({});
  const [activeEditorId, setActiveEditorId] = useState<number | null>(null);
  const [activeAuditIntegration, setActiveAuditIntegration] = useState<Integration | null>(null);


  // Form states for linking spreadsheet after OAuth redirect callback
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [boqName, setBoqName] = useState('');
  const [sheetsList, setSheetsList] = useState<{ id: string; name: string; has_headers: boolean }[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<{ [id: string]: boolean }>({});
  const [fetchingSheets, setFetchingSheets] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<{ id: string; name: string; type: 'folder' | 'file'; web_url?: string; is_google_sheet?: boolean; mime_type?: string }[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);

  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeConfigIntegrationId, setActiveConfigIntegrationId] = useState<number | null>(null);
  const isLoading = loading || globalLoading;

  // Overlay message inside the config modal (progress / success / error / warning)
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  // Cancel-during-import warning dialog
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  // Per-integration sync result shown on the workbook card
  const [syncResultMap, setSyncResultMap] = useState<{ [id: number]: { type: 'success' | 'error'; text: string } | null }>({});
  // Import-sheet confirmation (replaces window.confirm)
  const [importSheetWarning, setImportSheetWarning] = useState<{ integration: any; sheetName: string } | null>(null);

  // Folder navigation states
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<{ id: string; name: string }[]>([]);

  // Fetch spreadsheets/folders when the OAuth setup completes or folder changes
  useEffect(() => {
    const loadFiles = async () => {
      if (showConfigModal && oauthProvider && refreshToken && refreshToken !== 'existing') {
        setFetchingFiles(true);
        setError(null);
        try {
          const filterType = 'spreadsheets';
          const files = await listCloudFiles(oauthProvider, refreshToken, currentFolderId || undefined, filterType);
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
  }, [showConfigModal, oauthProvider, refreshToken, currentFolderId]);

  const visibleIntegrations = integrations.filter(i => {
    if (i.id === deletingId) return false;
    return i.module === 'boq';
  });



  // Check if spreadsheets are out of sync on load/refresh, and poll every 30 seconds
  useEffect(() => {
    const checkUpdates = async () => {
      const updates: { [id: number]: boolean } = {};
      const newSheets: { [id: number]: string[] } = {};
      for (const integration of visibleIntegrations) {
        if (deletingId === integration.id) continue;
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

    if (visibleIntegrations.length > 0) {
      checkUpdates();

      // Poll remote spreadsheet updates every 30 seconds in the background
      const intervalId = setInterval(() => {
        checkUpdates();
      }, 30000);

      return () => clearInterval(intervalId);
    }
  }, [integrations, deletingId]);

  const [syncingName, setSyncingName] = useState('');
  const [progressMessage, setProgressMessage] = useState('Connecting…');

  // Cycle through progress messages when active sync is running
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const messages = [
      'Connecting to sheet…',
      'Reading worksheet…',
      'Evaluating worksheet…',
      'Checking structure…',
      'Verifying format…',
      'Processing columns…',
      'Comparing schema…'
    ];
    let index = 0;

    const isSyncActive = loading || globalLoading || syncingId !== null;

    if (isSyncActive) {
      setProgressMessage(messages[0]);
      interval = setInterval(() => {
        index = (index + 1) % messages.length;
        setProgressMessage(messages[index]);
      }, 2500);
    } else {
      setProgressMessage('Connecting…');
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading, globalLoading, syncingId]);

  // Fetch sheet names when a spreadsheet is selected
  useEffect(() => {
    const loadSheets = async () => {
      const selectedFile = availableFiles.find(f => f.id === spreadsheetId);
      const isSpreadsheet = selectedFile && (
        selectedFile.is_google_sheet ||
        /\.(xlsx|xls|csv|ods|gsheet)$/i.test(selectedFile.name)
      );

      if (spreadsheetId && oauthProvider && refreshToken && refreshToken !== 'existing' && isSpreadsheet) {
        setFetchingSheets(true);
        setError(null);
        try {
          const sheets = await listCloudSheets({
            provider: oauthProvider,
            refresh_token: refreshToken,
            spreadsheet_id: spreadsheetId,
            check_headers: true,
          });
          setSheetsList(sheets);
          // For BoQ: pre-check sheets that have BoQ-compatible headers; for others: check all
          const initialSelection: { [id: string]: boolean } = {};
          sheets.forEach((s: any) => {
            initialSelection[s.id] = s.has_headers;
          });
          setSelectedSheets(initialSelection);

          // Auto-populate BOQ Name if blank
          if (!boqName && selectedFile) {
            const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
            setBoqName(nameWithoutExt);
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
        setFetchingSheets(false);
      }
    };
    loadSheets();
  }, [spreadsheetId, oauthProvider, refreshToken, availableFiles]);

  const handleSelectFile = async (file: any) => {
    if (file.type === 'folder') {
      handleFolderClick(file.id, file.name);
      return;
    }

    let targetId = file.id;
    let targetName = file.name;
    let conversionFailed = false;

    // Auto-convert Google Drive Excel (.xlsx) file immediately on click before fetching worksheets
    if (oauthProvider === 'google_sheets' && (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls'))) {
      setFetchingSheets(true);
      setError(null);
      try {
        const converted = await convertGoogleCloudFile(oauthProvider, (refreshToken === 'existing' || !refreshToken) ? '' : refreshToken, file.id);
        if (converted && converted.id) {
          targetId = converted.id;
          targetName = converted.name || file.name;
          setAvailableFiles(prev => prev.map(f => f.id === file.id ? { ...f, id: converted.id, name: targetName, is_google_sheet: true } : f));
        } else {
          conversionFailed = true;
        }
      } catch (convErr: any) {
        console.error('Google Sheets auto-conversion error:', convErr);
        conversionFailed = true;
        setError('Auto-conversion requires Google Drive file permissions. Please reconnect Google Drive or open Google Drive and select File > Save as Google Sheets.');
      } finally {
        setFetchingSheets(false);
      }
    }

    if (!conversionFailed) {
      setSpreadsheetId(targetId);
      if (!boqName) {
        const nameWithoutExt = targetName.replace(/\.[^/.]+$/, "");
        setBoqName(nameWithoutExt);
      }
    }
  };


  // Check URL parameters on mount to capture OAuth returns
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const provider = searchParams.get('oauth_provider');
      const token = searchParams.get('refresh_token');
      const err = searchParams.get('error');

      if (err) {
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_ERROR', error: decodeURIComponent(err) }, window.location.origin);
        } else {
          try {
            const bc = new BroadcastChannel('oauth_channel');
            bc.postMessage({ type: 'OAUTH_ERROR', error: decodeURIComponent(err) });
            bc.close();
          } catch (e) {
            // ignore
          }
        }
        
        // Attempt to close the popup
        window.close();
        
        // If window.close() failed (often happens if browser blocks script close),
        // fallback to just showing the error in the current window.
        setTimeout(() => {
          if (!window.closed) {
            setError(`OAuth Authorization Failed: ${decodeURIComponent(err)}`);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }, 500);

      } else if (provider && token) {
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_CALLBACK', provider, token }, window.location.origin);
        } else {
          try {
            const bc = new BroadcastChannel('oauth_channel');
            bc.postMessage({ type: 'OAUTH_CALLBACK', provider, token });
            bc.close();
          } catch (e) {
            // ignore
          }
        }
        
        // Attempt to close the popup
        window.close();
        
        // If window.close() failed, render the dashboard here as fallback
        setTimeout(() => {
          if (!window.closed) {
            setOauthProvider(provider);
            setRefreshToken(token);
            setShowConfigModal(true);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }, 500);
      }
    }
  }, []);

  // Listen to message events from popup window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // For window.postMessage, verify origin. BroadcastChannel doesn't have event.origin in the same way, 
      // but it's restricted to same-origin by the browser automatically.
      if (event.origin && event.origin !== window.location.origin && event.origin !== '') return;
      
      if (event.data?.type === 'OAUTH_CALLBACK') {
        const { provider, token } = event.data;
        setOauthProvider(provider);
        setRefreshToken(token);
        setShowConfigModal(true);
        setLoading(false);
      } else if (event.data?.type === 'OAUTH_ERROR') {
        setError(event.data.error || 'Authorization failed.');
        setLoading(false);
      }
    };
    
    window.addEventListener('message', handleOAuthMessage);
    
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('oauth_channel');
      bc.onmessage = handleOAuthMessage;
    } catch (e) {
      // ignore
    }

    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      if (bc) bc.close();
    };
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

  const resetConfigModal = () => {
    setShowConfigModal(false);
    setModalMessage(null);
    setCurrentFolderId(null);
    setNavigationHistory([]);
    setAvailableFiles([]);
    setSpreadsheetId('');
    setBoqName('');
    setSheetsList([]);
    setSelectedSheets({});
    setActiveConfigIntegrationId(null);
  };

  /**
   * Dismiss new sheets that the user deliberately left unchecked when closing
   * the configure modal for an existing integration.
   */
  const dismissUncheckedNewSheets = async (integrationId: number) => {
    const currentNewSheets = newSheetsMap[integrationId] || [];
    if (currentNewSheets.length === 0) return;
    // Sheets that exist in the newSheets list but were NOT checked by user = skip
    const unchecked = currentNewSheets.filter((name) => {
      const matching = sheetsList.find((s) => s.name === name);
      return !matching || !selectedSheets[matching.id];
    });
    if (unchecked.length > 0) {
      await handleDismissAlert(integrationId, unchecked);
    }
  };

  const handleCloseConfig = () => {
    if (loading) {
      setShowCancelWarning(true);
      return;
    }
    // If this was triggered from a new-sheet alert, dismiss unchecked ones
    if (activeConfigIntegrationId !== null) {
      dismissUncheckedNewSheets(activeConfigIntegrationId);
    }
    resetConfigModal();
  };

  const handleConfirmCancel = () => {
    setShowCancelWarning(false);
    setLoading(false);
    setGlobalLoading(false);
    resetConfigModal();
  };

  const handleOAuthInitiate = async (provider: 'google' | 'onedrive') => {
    const dbProvider = provider === 'google' ? 'google_sheets' : 'onedrive';

    setLoading(true);
    setError(null);

    const width = 600;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(
      'about:blank',
      'OAuthPopup',
      `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
    );

    if (popup) {
      popup.document.write(`
        <html>
          <head>
            <title>Connecting...</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #444; }
              .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #4f46e5; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin-bottom: 16px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <div id="status-msg">Checking existing connection...</div>
          </body>
        </html>
      `);
    }

    try {
      const authCheck = await getGlobalAuthToken(projectId, dbProvider);
      if (authCheck && authCheck.has_auth) {
        try {
          await listCloudFiles(dbProvider, authCheck.refresh_token, undefined, 'spreadsheets', projectId, 'boq');
          setOauthProvider(dbProvider);
          setRefreshToken(authCheck.refresh_token);
          setShowConfigModal(true);
          setLoading(false);
          if (popup) popup.close();
          return;
        } catch (tokenErr) {
          console.warn(`Cached ${provider} token is expired, proceeding to re-authenticate...`);
        }
      }
    } catch (err) {
      console.error("Global auth check failed:", err);
    }

    if (popup) {
      try {
        const msgEl = popup.document.getElementById('status-msg');
        if (msgEl) {
          msgEl.innerText = "Connecting to " + (provider === 'google' ? 'Google' : 'Microsoft') + "...";
        }
      } catch (e) {
      }
    }

    try {
      let url = '';
      if (provider === 'google') {
        const res = await getGoogleAuthUrl(projectId, 'pmo', 'boq');
        url = res.url;
      } else {
        const res = await getOneDriveAuthUrl(projectId, 'pmo', 'boq');
        url = res.url;
      }

      if (popup) {
        popup.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to initiate ${provider} authentication flow.`);
      setLoading(false);
      if (popup) popup.close();
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const checkedSheets = sheetsList.filter(s => selectedSheets[s.id]);
    if (!spreadsheetId.trim() || checkedSheets.length === 0 || !boqName.trim() || !oauthProvider || !refreshToken) {
      setModalMessage({ type: 'error', text: 'Please fill in a BOQ name and select at least one worksheet.' });
      return;
    }

    const sheetsNames = checkedSheets.map(s => s.name).join(', ');
    setSyncingName(sheetsNames);
    setLoading(true);
    setGlobalLoading(true);
    setModalMessage({ type: 'info', text: 'Linking spreadsheet…' });
    try {
      let targetSpreadsheetId = spreadsheetId.trim();
      const selectedFile = availableFiles.find(f => f.id === spreadsheetId);
      if (selectedFile && oauthProvider === 'google_sheets' && (selectedFile.name.toLowerCase().endsWith('.xlsx') || selectedFile.name.toLowerCase().endsWith('.xls'))) {
        setModalMessage({ type: 'info', text: 'Converting Excel file to native Google Sheets format...' });
        try {
          const converted = await convertGoogleCloudFile(oauthProvider, (refreshToken === 'existing' || !refreshToken) ? '' : refreshToken, selectedFile.id);
          if (converted && converted.id) {
            targetSpreadsheetId = converted.id;
          }
        } catch (convErr: any) {
          console.error('Google Sheets auto-conversion fallback:', convErr);
        }
      }

      const result = await saveIntegration({
        project_id: typeof projectId === 'string' ? parseInt(projectId) : projectId,
        provider: oauthProvider,
        spreadsheet_id: targetSpreadsheetId,
        sheet_name: JSON.stringify(checkedSheets),
        refresh_token: refreshToken === 'existing' ? undefined : refreshToken,
        boq_name: boqName.trim(),
        module: 'boq',
      });

      setModalMessage({ type: 'info', text: 'Spreadsheet linked! Importing data from the cloud…' });
      const syncResult = await triggerSyncImport(result.integration_id);
      onRefresh();
      if (syncResult?.preview_only) {
        const issues = (syncResult.validation_issues || []).slice(0, 3).join(' • ');
        setModalMessage({
          type: 'warning',
          text: `This workbook has been linked for preview only — it was not saved to the database.\n\nReason: It does not meet the BoQ structure requirements.${issues ? ` Issues: ${issues}` : ''
            }\n\nYou can still view it using the Inline Preview in the Linked Workbooks section.`,
        });
      } else {
        setModalMessage({ type: 'success', text: 'Import complete! Your BoQ data has been successfully imported into the database.' });
      }
    } catch (err: any) {
      console.error(err);
      setModalMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to link spreadsheet.' });
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };



  const handleManualSync = async (integrationId: number) => {
    const integration = integrations.find(i => i.id === integrationId);
    let sheetName = 'worksheet';
    if (integration?.sheet_name) {
      try {
        const parsed = JSON.parse(integration.sheet_name);
        if (Array.isArray(parsed) && parsed.length > 0) {
          sheetName = parsed.map((s: any) => s.name).join(', ');
        }
      } catch (e) {
        sheetName = integration.sheet_name;
      }
    }
    setSyncingName(sheetName);
    setSyncingId(integrationId);
    setSyncResultMap(prev => ({ ...prev, [integrationId]: null }));
    try {
      const syncResult = await triggerSyncImport(integrationId);
      onRefresh();
      if (syncResult?.preview_only) {
        const issues = (syncResult.validation_issues || []).slice(0, 2).join(' • ');
        setSyncResultMap(prev => ({
          ...prev, [integrationId]: {
            type: 'error',
            text: `Linked for preview only — not saved to database. This workbook does not meet BoQ structure requirements.${issues ? ` (${issues})` : ''
              }`,
          }
        }));
      } else {
        setSyncResultMap(prev => ({ ...prev, [integrationId]: { type: 'success', text: 'Sync complete! Items saved to database.' } }));
      }
    } catch (err) {
      setSyncResultMap(prev => ({ ...prev, [integrationId]: { type: 'error', text: 'Failed to trigger manual synchronization.' } }));
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnectClick = (integrationId: number) => {
    setDisconnectingId(integrationId);
  };

  const confirmDisconnect = async () => {
    if (disconnectingId === null) return;
    const id = disconnectingId;
    setDisconnectingId(null);
    setDeletingId(id);

    // Close preview/modal if open for this integration
    if (activeEditorId === id) setActiveEditorId(null);
    if (activeAuditIntegration?.id === id) setActiveAuditIntegration(null);

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
      onRefresh();
    } finally {
      setDeletingId(null);
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleConfirmDeleteIntegration = async () => {
    if (!integrationToDelete) return;
    const id = integrationToDelete.id;
    setDeletingId(id);

    if (activeEditorId === id) setActiveEditorId(null);
    if (activeAuditIntegration?.id === id) setActiveAuditIntegration(null);

    setLoading(true);
    setGlobalLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteIntegration(id, true);
      setSuccess('Workbook data and all associated database records deleted permanently.');
      await onRefresh();
      setIntegrationToDelete(null); // Close modal only after refresh completes
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError('Failed to delete workbook data from database.');
      await onRefresh();
      setIntegrationToDelete(null); // Close modal even on error
    } finally {
      setDeletingId(null);
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
    setActiveConfigIntegrationId(integration.id);
    try {
      const sheets = await listActiveIntegrationSheets(integration.id);
      setSheetsList(sheets);

      // Parse currently selected sheets
      let currentChecked: any[] = [];
      try {
        currentChecked = JSON.parse(integration.sheet_name);
      } catch (e) { }

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
    setImportSheetWarning({ integration, sheetName });
  };

  const handleConfirmImportSheet = () => {
    if (!importSheetWarning) return;
    const { integration, sheetName } = importSheetWarning;
    setImportSheetWarning(null);
    handleOpenConfigForActive(integration, sheetName);
  };

  const handleDismissAlert = async (integrationId: number, sheetNames: string[]) => {
    // Optimistically update UI immediately
    setDismissedNewSheets((prev) => ({ ...prev, [integrationId]: true }));
    // Clear from local map so they're gone even within current session
    setNewSheetsMap((prev) => ({ ...prev, [integrationId]: [] }));
    // Persist to backend so they never reappear on refresh
    try {
      await dismissIntegrationSheets(integrationId, sheetNames);
    } catch (e) {
      console.error('Failed to persist dismissed sheets:', e);
    }
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

  const showList = true;
  const showConnect = true;

  return (
    <div className="space-y-6">
      {/* Connect providers cards */}
      {showConnect && (
        <CloudConnectionCards
          success={success}
          moduleContext="boq"
          departmentName="General"
          googleIntegration={googleIntegration}
          onedriveIntegration={onedriveIntegration}
          isLoading={isLoading}
          handleOAuthInitiate={handleOAuthInitiate}
          formatGuidelines="To sync successfully, your cloud spreadsheets must use standard BOQ structures (columns for Description, Qty, Rate, and Amount). Avoid connecting progress tracking spreadsheets, weighted task matrices, or draft scratchpads."
        />
      )}

      {/* Config Modal after successful OAuth Callback */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#030305] rounded-2xl max-w-xl w-full p-6 shadow-[0_0_50px_rgba(0,243,255,0.1)] border border-white/10 max-h-[90vh] flex flex-col relative overflow-hidden">
            {/* In-modal overlay: progress / success / error / warning */}
            {modalMessage && (
              <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-8 rounded-2xl transition-all duration-300 ${modalMessage.type === 'info'
                ? 'bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 text-white shadow-2xl overflow-hidden'
                : modalMessage.type === 'success'
                  ? 'bg-green-50'
                  : modalMessage.type === 'error'
                    ? 'bg-red-50'
                    : 'bg-amber-50/95 backdrop-blur-sm'
                }`}>
                {modalMessage.type === 'info' ? (
                  <>
                    {/* Ambient Glow Orbs */}
                    <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />

                    {/* Multi-Ring Futuristic Radar Scanner */}
                    <div className="relative flex items-center justify-center w-24 h-24 mb-6 z-10">
                      <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 border-r-indigo-400 animate-spin" />
                      <div className="absolute inset-2 rounded-full border-2 border-cyan-500/30 border-b-cyan-400 border-l-cyan-400 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
                      <div className="p-3.5 bg-indigo-950/80 rounded-2xl border border-indigo-400/40 text-indigo-300 shadow-inner">
                        <FileSpreadsheet className="w-7 h-7 animate-bounce [animation-duration:2s]" />
                      </div>
                    </div>

                    <h3 className="text-xl font-extrabold text-white mb-2 tracking-tight z-10">Processing Spreadsheet</h3>

                    {/* Active Step Badge */}
                    <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-cyan-300 text-xs font-semibold shadow-inner mb-6 animate-pulse z-10">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <span>{progressMessage}</span>
                    </div>

                    {/* Pipeline Steps Visualizer */}
                    <div className="w-full max-w-xs space-y-2 z-10">
                      <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                        <span>Pipeline Stage</span>
                        <span className="text-indigo-400">In Progress</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                        <div className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full animate-pulse transition-all duration-500 w-3/4" />
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[9px] text-center font-semibold text-gray-400 pt-1">
                        <span className="text-indigo-400 font-bold">Connect</span>
                        <span className="text-indigo-400 font-bold">Slice</span>
                        <span className="text-cyan-400 font-bold animate-pulse">Scan</span>
                        <span className="text-slate-400">Sync</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {modalMessage.type === 'success' && (
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-5">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {modalMessage.type === 'error' && (
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-5">
                        <X className="w-8 h-8 text-red-600" />
                      </div>
                    )}
                    {modalMessage.type === 'warning' && (
                      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-5">
                        <AlertTriangle className="w-8 h-8 text-amber-600 animate-pulse" />
                      </div>
                    )}
                    <p className={`text-center font-bold text-lg mb-2 ${modalMessage.type === 'success' ? 'text-green-800' :
                      modalMessage.type === 'error' ? 'text-red-800' : 'text-amber-800'
                      }`}>
                      {modalMessage.type === 'success' ? 'Success!' :
                        modalMessage.type === 'error' ? 'Something went wrong' : 'Workbook Linked as Preview'}
                    </p>
                    <p className={`text-center text-sm mb-8 max-w-sm leading-relaxed ${modalMessage.type === 'success' ? 'text-green-700' :
                      modalMessage.type === 'error' ? 'text-red-700' : 'text-amber-700'
                      }`}>
                      {modalMessage.text}
                    </p>
                    <button
                      onClick={resetConfigModal}
                      className={`px-10 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] ${modalMessage.type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                        modalMessage.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                    >
                      OK
                    </button>
                  </>
                )}
              </div>
            )}
            <h3 className="text-xl font-bold text-slate-200 mb-2 flex-shrink-0">
              Link Workbook
            </h3>
            <p className="text-sm text-slate-400 mb-4 flex-shrink-0">
              Successfully authenticated with <span className="font-semibold capitalize text-slate-300">{oauthProvider?.replace('_', ' ')}</span>. Configure the sheet file mapping details below:
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
                  <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-3.5 flex items-center space-x-3 text-sm text-indigo-950">
                    <FileSpreadsheet className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                    <div>
                      <span className="block font-semibold text-xs text-indigo-500 uppercase tracking-wide">Linked Cloud Workbook</span>
                      <span className="font-bold text-slate-200">{boqName || 'Spreadsheet BOQ'}</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5 font-mono">File ID: {spreadsheetId}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase">Select Spreadsheet</label>
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
                    <div className="text-[11px] text-gray-400 truncate mb-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
                      <span className="font-semibold text-slate-400">Path:</span> Home
                      {navigationHistory.map((folder) => (
                        <span key={folder.id}> / {folder.name}</span>
                      ))}
                    </div>

                    {oauthProvider === 'google_sheets' && (
                      <div className="mb-2 bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-2.5 text-xs text-indigo-200 leading-relaxed">
                        <span className="font-bold">Google Drive Format:</span> Any Excel file (<code className="font-mono bg-blue-100 px-1 rounded text-[11px]">.xlsx</code>) you click will be automatically converted to native Google Sheets format so its worksheets can be loaded. If auto-conversion is restricted by Drive permissions, open the file in Google Drive and select <strong>File &gt; Save as Google Sheets</strong>.
                      </div>
                    )}

                    {fetchingFiles ? (
                      <div className="w-full h-48 border border-slate-700/50 rounded-xl bg-slate-800/50/50 flex flex-col items-center justify-center text-slate-400 space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        <span className="text-xs font-medium">Scanning drive folder...</span>
                      </div>
                    ) : (
                      <div className="w-full h-48 border border-slate-700/50 rounded-xl overflow-y-auto divide-y divide-gray-100 bg-slate-900">
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
                                className={`flex items-center justify-between p-3 transition-all duration-150 ${isSelected
                                  ? 'bg-emerald-900/20 text-emerald-100 font-bold border-l-4 border-emerald-500'
                                  : 'hover:bg-slate-800/50 text-slate-300 font-medium'
                                  }`}
                              >
                                <div
                                  onClick={() => handleSelectFile(file)}
                                  className="flex-1 flex items-center space-x-3 min-w-0 cursor-pointer"
                                >
                                  {isFolder ? (
                                    <Folder className="w-5 h-5 text-amber-500 fill-amber-100 flex-shrink-0" />
                                  ) : (
                                    <FileSpreadsheet className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-emerald-600' : 'text-gray-400'}`} />
                                  )}
                                  <span className="text-xs truncate">{file.name}</span>
                                  {oauthProvider === 'google_sheets' && !isFolder && (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) && (
                                    <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-1 py-0.5 rounded flex-shrink-0">
                                      Excel (.xlsx) - Auto-Convert
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                  {isFolder ? (
                                    <ChevronRight
                                      className="w-4 h-4 text-gray-400 hover:text-indigo-500 cursor-pointer"
                                      onClick={() => handleFolderClick(file.id, file.name)}
                                    />
                                  ) : (
                                    <>
                                      {isSelected && (
                                        <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded-md uppercase">Selected</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                    {spreadsheetId && (
                      <div className="mt-2 text-xs text-emerald-400 bg-emerald-900/20 p-2 rounded-lg border border-emerald-500/30 flex items-center">
                        <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                        <span>Selected: {availableFiles.find((f) => f.id === spreadsheetId)?.name}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">BOQ Document Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Phase 1 BOQ"
                    value={boqName}
                    onChange={(e) => setBoqName(e.target.value)}
                    className="w-full p-2.5 border border-slate-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-900 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                    Select Worksheets to Link
                  </label>
                  {fetchingSheets ? (
                    <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Loading worksheets...</span>
                    </div>
                  ) : sheetsList.length === 0 ? (
                    <div className="text-xs text-gray-400 italic bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                      Select a spreadsheet first to load its sheets.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto border border-slate-700/50 rounded-xl p-3 bg-slate-800/50/50">
                      {sheetsList.map((sheet) => (
                        <label key={sheet.id} className="flex items-start space-x-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-slate-800/70 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!selectedSheets[sheet.id]}
                            onChange={(e) =>
                              setSelectedSheets((prev) => ({
                                ...prev,
                                [sheet.id]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-600 rounded focus:ring-indigo-500"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-slate-300 truncate block">{sheet.name}</span>
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

              <div className="flex space-x-3 pt-4 border-t border-slate-700/50 flex-shrink-0 bg-slate-900">
                <button
                  type="button"
                  onClick={handleCloseConfig}
                  className="flex-1 py-2.5 px-4 border border-slate-700/50 rounded-lg text-sm text-slate-400 hover:bg-slate-800/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || fetchingSheets || !spreadsheetId}
                  className="flex-1 py-2.5 px-4 border border-transparent rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {(loading || fetchingSheets) && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  <span>{loading ? 'Linking...' : fetchingSheets ? 'Converting Sheet...' : 'Link Workbook'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Integrations list */}
      {showList && visibleIntegrations.length > 0 && (
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

              // Compute premium styles dynamically
              const cardClass = isSyncing
                ? "bg-white/10 backdrop-blur-md border-neon-cyan shadow-[0_0_15px_rgba(0,243,255,0.3)] animate-pulse"
                : isPreviewOnly
                  ? "bg-white/5 backdrop-blur-md border-neon-purple/50 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_20px_rgba(188,19,254,0.2)] hover:border-neon-purple"
                  : "bg-white/5 backdrop-blur-md border-neon-cyan/30 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_20px_rgba(0,243,255,0.2)] hover:border-neon-cyan/60";

              const iconClass = isSyncing
                ? "bg-neon-cyan/20 text-neon-cyan animate-spin shadow-[0_0_10px_rgba(0,243,255,0.2)] border border-neon-cyan/50"
                : isPreviewOnly
                  ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/50 shadow-[0_0_10px_rgba(188,19,254,0.2)]"
                  : isGoogle
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)]"
                    : "bg-neon-purple/20 text-neon-purple border border-neon-purple/50 shadow-[0_0_10px_rgba(188,19,254,0.2)]";

              return (
                <div key={integration.id} className="space-y-2">
                  <div className={`rounded-xl p-5 border flex flex-col md:flex-row md:items-start md:justify-between gap-4 transition-all duration-300 ${cardClass}`}>
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
                        <h4 className="font-bold text-white drop-shadow-md text-sm truncate flex items-center space-x-2 flex-wrap gap-y-1">
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/integrations/${integration.id}/open`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-white hover:text-neon-cyan transition-colors inline-flex items-center space-x-1"
                            title={`Open in ${isGoogle ? 'Google Sheets' : 'Excel Online'}. Note: Ensure your browser is logged in to the account containing this file.`}
                          >
                            <span>{integration.boq_name || 'Spreadsheet BOQ'}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-neon-cyan" />
                          </a>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border ${isGoogle ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)]' : 'bg-neon-purple/20 text-neon-purple border-neon-purple/50 shadow-[0_0_10px_rgba(188,19,254,0.2)]'}`}>
                            {isGoogle ? 'Google Sheets' : 'OneDrive'}
                          </span>
                          {isPreviewOnly ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-neon-purple/20 text-neon-purple border border-neon-purple/50 shadow-[0_0_10px_rgba(188,19,254,0.2)]">
                              Preview Only
                            </span>
                          ) : null}
                          {outOfSyncMap[integration.id] && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-neon-pink/20 text-neon-pink border border-neon-pink/50 shadow-[0_0_10px_rgba(255,0,127,0.3)] animate-pulse">
                              <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                              Out of Sync (Edits in cloud)
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-gray-400 mt-1 truncate"><span className="font-bold text-slate-400">File ID:</span> {integration.spreadsheet_id}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate"><span className="font-bold text-slate-400">Worksheets:</span> {renderSheetNames(integration.sheet_name)}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {isSyncing ? (
                            <span className="text-neon-cyan font-bold animate-pulse flex items-center space-x-1 text-xs drop-shadow-[0_0_5px_rgba(0,243,255,0.5)]">
                              <Loader2 className="w-3 h-3 animate-spin mr-1 text-neon-cyan" />
                              Sync in progress… updating database structure
                            </span>
                          ) : (
                            <>
                              Last Synced: {integration.last_synced_at ? new Date(integration.last_synced_at).toLocaleString() : 'Never'}
                              <span className="text-slate-400 mx-1.5">•</span>
                              <span
                                className="text-slate-400 font-medium cursor-help hover:text-neon-cyan transition-colors"
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
                                    <span className="font-extrabold text-amber-500 select-none">•</span>
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
                                <AlertTriangle className="w-4 h-4 text-amber-650 flex-shrink-0 mt-0.5" />
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

                    <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 p-1.5 rounded-2xl flex-shrink-0 shadow-inner">
                      <button
                        disabled={isLoading || syncingId !== null || deletingId !== null}
                        onClick={() => setActiveAuditIntegration(integration)}
                        className="p-2 hover:bg-neon-cyan text-neon-cyan hover:text-black rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_10px_rgba(0,243,255,0.4)]"
                        title="Structure Report (Format Assessment)"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                      <button
                        disabled={isLoading || syncingId !== null || deletingId !== null}
                        onClick={() => setActiveEditorId(activeEditorId === integration.id ? null : integration.id)}
                        className={`p-2 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${activeEditorId === integration.id
                          ? 'bg-neon-purple text-white shadow-[0_0_10px_rgba(188,19,254,0.4)]'
                          : 'hover:bg-neon-purple hover:text-white text-gray-400 hover:shadow-[0_0_10px_rgba(188,19,254,0.4)]'
                          }`}
                        title={activeEditorId === integration.id ? 'Hide inline preview' : 'Open inline preview'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        disabled={isLoading || syncingId !== null || deletingId !== null}
                        onClick={() => handleManualSync(integration.id)}
                        title={syncingId === integration.id ? `Syncing worksheets: ${syncingName}` : "Sync workbook data"}
                        className="p-2 hover:bg-neon-cyan text-neon-cyan hover:text-black rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_10px_rgba(0,243,255,0.4)]"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingId === integration.id ? 'animate-spin text-black' : ''}`} />
                      </button>

                      <button
                        disabled={isLoading || syncingId !== null || deletingId !== null}
                        onClick={() => setIntegrationToDelete(integration)}
                        className="p-2 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                        title="Delete workbook data permanently from database"
                      >
                        <Trash2 className="w-4 h-4" />
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
      )}
      {/* Cancel Import Warning Modal */}
      {showCancelWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700/50 animate-scale-up">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Cancel Import?</h3>
                <p className="text-xs text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">If you cancel now, the following will happen:</p>
            <ul className="text-sm text-slate-400 space-y-1.5 mb-6">
              <li className="flex items-start space-x-2"><span className="text-red-500 font-bold">•</span><span>The workbook will <strong>not</strong> be linked to this project.</span></li>
              <li className="flex items-start space-x-2"><span className="text-red-500 font-bold">•</span><span>Any data already fetched will be <strong>discarded</strong>.</span></li>
              <li className="flex items-start space-x-2"><span className="text-red-500 font-bold">•</span><span>You will need to start the linking process <strong>again</strong>.</span></li>
            </ul>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelWarning(false)}
                className="flex-1 py-2.5 px-4 border border-indigo-500/40 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-xs font-semibold text-indigo-700 active:scale-[0.98] transition-all duration-100"
              >
                Continue Import
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm active:scale-[0.98] transition-all duration-100"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Sheet Confirmation Modal */}
      {importSheetWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700/50 animate-scale-up">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Import Worksheet</h3>
                <p className="text-xs text-gray-400">Add to your linked workbook</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              The worksheet <strong className="text-slate-200">&ldquo;{importSheetWarning.sheetName}&rdquo;</strong> has not been imported yet.
              Importing it will add it to your linked workbook and make it available for BoQ data extraction and syncing.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setImportSheetWarning(null)}
                className="flex-1 py-2.5 px-4 border border-slate-700/50 hover:bg-slate-800/50 rounded-xl text-xs font-semibold text-slate-300 active:scale-[0.98] transition-all duration-100"
              >
                Not Now
              </button>
              <button
                onClick={handleConfirmImportSheet}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm active:scale-[0.98] transition-all duration-100"
              >
                Import Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Disconnect Confirmation Modal */}
      {disconnectingId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700/50 flex flex-col relative animate-scale-up">
            <button
              onClick={() => setDisconnectingId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-slate-400 active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-50 rounded-xl text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Disconnect Spreadsheet</h3>
                <p className="text-xs text-gray-400">Syncing will be disabled</p>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Are you sure you want to disconnect this spreadsheet? This will stop automatic syncing, but your imported items will remain in the database.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setDisconnectingId(null)}
                className="flex-1 py-2.5 px-4 border border-slate-700/50 hover:bg-slate-800/50 rounded-xl text-xs font-semibold text-slate-300 active:scale-[0.98] transition-all duration-100"
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

      {/* Custom Irreversible Deletion Warning Modal */}
      {integrationToDelete !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700/50 animate-scale-up relative">
            <button
              onClick={() => setIntegrationToDelete(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-slate-400 active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-100 rounded-xl text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Irreversible Deletion Warning</h3>
                <p className="text-xs text-red-600 font-semibold">Permanent Database Purge</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              You are about to perform an irreversible deletion of the document data for{' '}
              <strong className="text-white font-semibold">{integrationToDelete.boq_name || 'Spreadsheet BOQ'}</strong>{' '}
              from the database and all of its records will be deleted permanently. Do you wish to continue?
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
              <p className="text-[11px] font-semibold text-amber-900 leading-relaxed">
                Cloud Storage Safeguard: <span className="font-normal text-amber-800">Note: This action will NOT delete the actual file in your cloud drive.</span>
              </p>
            </div>

            {isLoading && (
              <div className="flex items-center space-x-2 text-red-650 bg-red-50/70 border border-red-100 p-3 rounded-xl mb-4 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-red-600 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-red-700">Unlinking and permanently deleting data from database...</span>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                disabled={isLoading}
                onClick={() => setIntegrationToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-slate-700/50 hover:bg-slate-800/50 rounded-xl text-xs font-semibold text-slate-300 active:scale-[0.98] transition-all duration-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isLoading}
                onClick={handleConfirmDeleteIntegration}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all duration-100 disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Structure Report Modal */}
      {activeAuditIntegration !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700/50 flex flex-col relative animate-scale-up max-h-[90vh] overflow-hidden">
            <button
              onClick={() => setActiveAuditIntegration(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-slate-400 active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-650 text-indigo-600">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Structure Report</h3>
                <p className="text-xs text-gray-400">Format Assessment</p>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1.5 mb-6 space-y-5">
              {/* Score Gauge */}
              <div className="flex flex-col items-center justify-center py-5 bg-indigo-50/40 rounded-2xl border border-indigo-500/30/50">
                <div className={`relative flex items-center justify-center w-24 h-24 rounded-full border-4 bg-slate-900 shadow-sm transition-colors ${activeAuditIntegration.validation_score === null || activeAuditIntegration.validation_score === undefined ? 'border-slate-700/50' :
                  Math.round(activeAuditIntegration.validation_score * 100) >= 90 ? 'border-emerald-500' :
                    Math.round(activeAuditIntegration.validation_score * 100) >= 75 ? 'border-amber-500' : 'border-red-500'
                  }`}>
                  <span className={`text-2xl font-extrabold ${activeAuditIntegration.validation_score === null || activeAuditIntegration.validation_score === undefined ? 'text-slate-400' :
                    Math.round(activeAuditIntegration.validation_score * 100) >= 90 ? 'text-emerald-600' :
                      Math.round(activeAuditIntegration.validation_score * 100) >= 75 ? 'text-amber-600' : 'text-red-650'
                    }`}>
                    {activeAuditIntegration.validation_score !== null && activeAuditIntegration.validation_score !== undefined
                      ? `${Math.round(activeAuditIntegration.validation_score * 100)}%`
                      : 'N/A'}
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mt-2.5">Structure Match Score</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-2 inline-block ${!activeAuditIntegration.preview_only ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                  {!activeAuditIntegration.preview_only ? 'Valid Structure' : 'Preview Only'}
                </span>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-4 text-xs text-gray-650 leading-relaxed">
                <div>
                  <span className="font-bold text-slate-200 block mb-1">Workbook Source:</span>
                  <span className="font-medium text-slate-400 bg-slate-800/50 px-2 py-1 rounded inline-block truncate max-w-full font-mono">
                    {activeAuditIntegration.boq_name || 'Spreadsheet BOQ'}
                  </span>
                </div>

                <div>
                  <span className="font-bold text-slate-200 block mb-1">Structure Scan Summary:</span>
                  <p className="text-gray-650">
                    {activeAuditIntegration.validation_summary || (!activeAuditIntegration.preview_only ? (
                      "The system successfully scanned the spreadsheet contents. It confirmed that the row structure represents a valid Bill of Quantities (material descriptions, pricing rates, unit measures, and total amounts) with a high coverage of construction items."
                    ) : (
                      "The structure scan detected layout or content irregularities in the spreadsheet row descriptions that do not match the expected Bill of Quantities checklist structure."
                    ))}
                  </p>
                </div>

                {activeAuditIntegration.validation_issues && activeAuditIntegration.validation_issues.length > 0 ? (
                  <div>
                    <span className="font-bold text-slate-200 block mb-1.5">Discovered Issues & Observations:</span>
                    <ul className="space-y-1.5 pl-1.5">
                      {activeAuditIntegration.validation_issues.map((issue: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2 text-slate-300">
                          <span className="text-amber-500 font-extrabold select-none">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    <span className="font-bold text-slate-200 block mb-1">Observations:</span>
                    <span className="text-green-700 font-semibold flex items-center space-x-1">
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>All semantic and layout structure checks passed successfully.</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setActiveAuditIntegration(null)}
              className="w-full py-2.5 bg-gray-850 hover:bg-gray-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-100 active:scale-[0.98] bg-gray-800 flex-shrink-0"
            >
              Close Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}