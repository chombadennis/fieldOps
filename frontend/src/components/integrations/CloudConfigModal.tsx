import React from 'react';
import { FileSpreadsheet, FileText, AlertTriangle, ArrowLeft, Loader2, X, ChevronRight, ChevronDown, CheckCircle2, Folder, Paperclip } from 'lucide-react';

export default function CloudConfigModal(props: any) {
  const {
    showConfigModal,
    modalMessage,
    oauthProvider,
    availableFiles,
    spreadsheetId,
    boqName,
    setBoqName,
    refreshToken,
    navigationHistory,
    fetchingFiles,
    formatGuidelines,
    isFileAllowed,
    handleSaveConfig,
    handleNavigateBack,
    handleFolderClick,
    handleSelectFile,
    resetConfigModal,
    handleCloseConfig,
    sheetsList,
    selectedSheets,
    handleSheetSelection,
    fetchingSheets,
    savingConfig,
    moduleContext,
    trackingMode,
    setTrackingMode,
    ipcCertificateNumber,
    setIpcCertificateNumber,
    handleLinkAsDocument
  } = props;

  if (!showConfigModal) return null;

  // New handler to reset modal state and then close
  const handleCancel = () => {
    // Reset modal-specific state using provided reset function
    resetConfigModal();
    // Invoke the passed close handler if it exists
    if (handleCloseConfig) handleCloseConfig();
  };

  return (
    <>
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col relative overflow-hidden">
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

                    {/* Animated Pulsing Hex Background Accent */}
                    <div className="relative mb-6 flex items-center justify-center">
                      <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 border-r-indigo-400 animate-spin" />
                      <div className="absolute inset-2 rounded-full border-2 border-cyan-500/30 border-b-cyan-400 border-l-cyan-400 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
                      <div className="p-3.5 bg-indigo-950/80 rounded-2xl border border-indigo-400/40 text-indigo-300 shadow-inner">
                        {(() => {
                          const selectedFile = availableFiles.find((f: any) => f.id === spreadsheetId);
                          const isSpreadsheet = selectedFile ? (selectedFile.is_google_sheet || /\.(xlsx|xls|csv|ods|gsheet)$/i.test(selectedFile.name)) : true;
                          return isSpreadsheet ? (
                            <FileSpreadsheet className="w-7 h-7 animate-bounce [animation-duration:2s]" />
                          ) : (
                            <FileText className="w-7 h-7 animate-bounce [animation-duration:2s]" />
                          );
                        })()}
                      </div>
                    </div>

                    {(() => {
                      const selectedFile = availableFiles.find((f: any) => f.id === spreadsheetId);
                      const isSpreadsheet = selectedFile ? (selectedFile.is_google_sheet || /\.(xlsx|xls|csv|ods|gsheet)$/i.test(selectedFile.name)) : true;
                      return (
                        <>
                          <h3 className="text-xl font-extrabold text-white mb-2 tracking-tight z-10">
                            {moduleContext === 'budget' ? 'Workbook Linkage Setup' : (isSpreadsheet ? 'Processing Spreadsheet' : 'Linking Document')}
                          </h3>

                          {/* Active Step Badge */}
                          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-cyan-300 text-xs font-semibold shadow-inner mb-6 animate-pulse z-10">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                            <span>{modalMessage?.text || (isSpreadsheet ? 'Linking spreadsheet…' : 'Linking document…')}</span>
                          </div>

                          {/* Pipeline Steps Visualizer */}
                          <div className="w-full max-w-xs space-y-2 z-10">
                            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                              <span>Process Status</span>
                              <span className="text-indigo-400">In Progress</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                              <div className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full animate-pulse transition-all duration-500 w-3/4" />
                            </div>
                            <div className="grid grid-cols-4 gap-1 text-[9px] text-center font-semibold text-gray-400 pt-1">
                              <span className="text-indigo-400 font-bold">Connect</span>
                              <span className="text-indigo-400 font-bold">{isSpreadsheet ? 'Slice' : 'Attach'}</span>
                              <span className="text-cyan-400 font-bold animate-pulse">{isSpreadsheet ? 'Scan' : 'Register'}</span>
                              <span className="text-gray-500">Done</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
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
            <h3 className="text-xl font-bold text-gray-800 mb-2 flex-shrink-0">
              {moduleContext === 'budget' ? 'Workbook Linkage Setup' : 'Link Cloud Document'}
            </h3>
            <p className="text-sm text-gray-500 mb-4 flex-shrink-0">
              Successfully authenticated with <span className="font-semibold capitalize text-gray-700">{oauthProvider?.replace('_', ' ')}</span>. {moduleContext === 'budget' ? 'Select a budget spreadsheet workbook below:' : 'Select a document or spreadsheet file below:'}
            </p>

            <form onSubmit={handleSaveConfig} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 min-h-0 pb-4">


                {refreshToken === 'existing' ? (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 flex items-center space-x-3 text-sm text-indigo-950">
                    <FileSpreadsheet className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                    <div>
                      <span className="block font-semibold text-xs text-indigo-500 uppercase tracking-wide">Linked Cloud Document</span>
                      <span className="font-bold text-gray-800">{boqName || 'Cloud Document'}</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5 font-mono">File ID: {spreadsheetId}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-600 uppercase">
                        {moduleContext === 'budget' ? 'Select Workbook' : 'Select File or Document'}
                      </label>
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
                      {navigationHistory.map((folder: any) => (
                        <span key={folder.id}> / {folder.name}</span>
                      ))}
                    </div>

                    {oauthProvider === 'google_sheets' && (
                      <div className="mb-2 bg-blue-50/80 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-900 leading-relaxed">
                        <span className="font-bold">Google Drive Format:</span> Any Excel file (<code className="font-mono bg-blue-100 px-1 rounded text-[11px]">.xlsx</code>) you click will be automatically converted to native Google Sheets format so its worksheets can be loaded. If auto-conversion is restricted by Drive permissions, open the file in Google Drive and select <strong>File &gt; Save as Google Sheets</strong>.
                      </div>
                    )}

                    {oauthProvider === 'onedrive' && (
                      <div className="mb-2 bg-blue-50/80 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-900 leading-relaxed">
                        <span className="font-bold">OneDrive Format:</span> Microsoft OneDrive integration only supports native Excel Workbooks (<code className="font-mono bg-blue-100 px-1 rounded text-[11px]">.xlsx</code>). CSV files are not supported and are hidden from this list. If you need to link a CSV file, please open it in OneDrive and save it as an Excel Workbook first.
                      </div>
                    )}

                    {fetchingFiles ? (
                      <div className="w-full h-48 border border-gray-200 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center text-gray-500 space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        <span className="text-xs font-medium">Scanning drive folder...</span>
                      </div>
                    ) : (
                      <div className="w-full h-48 border border-gray-200 rounded-xl overflow-y-auto divide-y divide-gray-100 bg-white">
                        {availableFiles.filter(isFileAllowed).length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-xs text-gray-400 p-6 text-center space-y-2">
                            <span className="font-semibold text-gray-500">No supported files found in this folder.</span>
                            <span>{formatGuidelines}</span>
                          </div>
                        ) : (
                          availableFiles
                            .filter(isFileAllowed)
                            .filter((file: any) => !(oauthProvider === 'onedrive' && file.name.toLowerCase().endsWith('.csv')))
                            .map((file: any) => {
                              const isFolder = file.type === 'folder';
                              const isSelected = spreadsheetId === file.id;
                              return (
                                <div
                                  key={file.id}
                                  className={`flex items-center justify-between p-3 transition-all duration-150 ${file.already_linked_module
                                      ? 'opacity-60 bg-gray-50 cursor-not-allowed border-l-4 border-gray-300'
                                      : isSelected
                                        ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-500'
                                        : 'hover:bg-gray-50 text-gray-700 font-medium'
                                    }`}
                                >
                                  <div
                                    onClick={() => {
                                      if (file.already_linked_module) return;
                                      isFolder ? handleFolderClick(file.id, file.name) : handleSelectFile(file.id);
                                    }}
                                    className={`flex-1 flex items-center space-x-3 min-w-0 ${file.already_linked_module ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                  >
                                    {isFolder ? (
                                      <Folder className="w-5 h-5 text-amber-500 fill-amber-100 flex-shrink-0" />
                                    ) : (
                                      <FileSpreadsheet className={`w-5 h-5 flex-shrink-0 ${file.already_linked_module ? 'text-gray-400' : isSelected ? 'text-emerald-600' : 'text-gray-400'}`} />
                                    )}
                                    <span className="text-xs truncate">{file.name}</span>
                                    {file.already_linked_module && (
                                      <span className="text-[9px] bg-red-50 text-red-700 border border-red-200 font-extrabold px-2 py-0.5 rounded flex-shrink-0 flex items-center space-x-1">
                                        <span>Linked in [{file.already_linked_module}] • Locked</span>
                                      </span>
                                    )}
                                    {file.is_rejected && !file.already_linked_module && (
                                      <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 font-extrabold px-1.5 py-0.5 rounded flex-shrink-0">
                                        Flagged ({file.rejected_reason})
                                      </span>
                                    )}
                                    {oauthProvider === 'google_sheets' && !isFolder && !file.already_linked_module && (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) && (
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
                                        {moduleContext === 'department' && file.web_url && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleLinkAsDocument(file);
                                            }}
                                            className="px-2.5 py-1 bg-dark-teal-800 hover:bg-dark-teal-900 text-white rounded-lg text-[10px] font-bold shadow-sm transition active:scale-95 flex items-center space-x-1"
                                            title="Link as Department Document"
                                          >
                                            <Paperclip className="w-3.5 h-3.5" />
                                            <span>Link Document</span>
                                          </button>
                                        )}
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
                      <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex items-center">
                        <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                        <span>Selected: {availableFiles.find((f: any) => f.id === spreadsheetId)?.name}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    {moduleContext === 'budget' ? 'Workbook Title / Label (Optional)' : 'Document Title / Label (Optional)'}
                  </label>
                  <input
                    type="text"
                    placeholder={moduleContext === 'budget' ? 'e.g. Master Project Budget / Structural Trade' : 'e.g. IPC Claim No. 8 / Structural Report'}
                    value={boqName}
                    onChange={(e) => setBoqName(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-800"
                  />
                </div>

                {moduleContext === 'ipc' && (
                  <div className="mt-4 mb-2">
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1 text-indigo-700">IPC Certificate Number (Required)</label>
                    <input
                      type="text"
                      placeholder="e.g. 3 or IPC-03"
                      value={ipcCertificateNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 15);
                        setIpcCertificateNumber(val);
                      }}
                      disabled={savingConfig || fetchingSheets || !!modalMessage}
                      className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50/50 text-indigo-900 disabled:opacity-50 disabled:bg-gray-100 font-bold placeholder:font-normal placeholder:text-indigo-300"
                      required
                    />
                  </div>
                )}

                {(() => {
                  const selectedFile = availableFiles.find((f: any) => f.id === spreadsheetId);
                  if (!selectedFile) {
                    return (
                      <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-gray-100">
                        Select a file or spreadsheet above to configure details.
                      </div>
                    );
                  }

                  const isSpreadsheet = selectedFile.is_google_sheet || /\.(xlsx|xls|csv|ods|gsheet)$/i.test(selectedFile.name);

                  return (
                    <div className="space-y-3">
                      {selectedFile.already_linked_module && (
                        <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 leading-relaxed flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block text-indigo-950">Cross-Module Integration Notice</span>
                            This file is currently linked in the <strong>[{selectedFile.already_linked_module}]</strong> module. Linking it here will share cloud data updates across both tabs.
                          </div>
                        </div>
                      )}

                      {!isSpreadsheet ? (
                        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 text-xs text-indigo-900 leading-relaxed">
                          <span className="font-bold block text-xs text-indigo-950 mb-0.5">Document Selected ({selectedFile.name})</span>
                          This file format will be linked directly to your workspace without worksheet mapping.
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">
                            Select Worksheets to Link
                          </label>
                          {fetchingSheets ? (
                            <div className="flex items-center space-x-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                              <span>Loading worksheets...</span>
                            </div>
                          ) : sheetsList.length === 0 ? (
                            <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200/60 leading-relaxed font-medium">
                              No worksheets found or could not load structure. Please verify the workbook format.
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                              {sheetsList.map((sheet: any) => (
                                <label key={sheet.id} className="flex items-start space-x-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-gray-100/70 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={!!selectedSheets[sheet.id]}
                                    onChange={(e) =>
                                      props.setSelectedSheets((prev: any) => ({
                                        ...prev,
                                        [sheet.id]: e.target.checked,
                                      }))
                                    }
                                    className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-semibold text-gray-700 truncate block">{sheet.name}</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100 flex-shrink-0 bg-white">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-2.5 px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                {(() => {
                  const selectedFile = availableFiles.find((f: any) => f.id === spreadsheetId);
                  const isSpreadsheet = selectedFile && (
                    selectedFile.is_google_sheet ||
                    /\.(xlsx|xls|csv|ods|gsheet)$/i.test(selectedFile.name)
                  );
                  const buttonLabel = isSpreadsheet ? 'Link Workbook' : 'Link Document';
                  const isNoSheets = isSpreadsheet && sheetsList.length === 0;
                  const isLocked = selectedFile?.already_linked_module;
                  const isButtonDisabled = savingConfig || fetchingSheets || !spreadsheetId || isNoSheets || isLocked || (moduleContext === 'ipc' && !ipcCertificateNumber);

                  return (
                    <button
                      type="submit"
                      disabled={isButtonDisabled}
                      className="flex-1 py-2.5 px-4 border border-transparent rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {(savingConfig || fetchingSheets) && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                      <span>{savingConfig ? 'Linking...' : fetchingSheets ? 'Loading Worksheets...' : buttonLabel}</span>
                    </button>
                  );
                })()}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
