import React, { useState } from 'react';
import { Save, FileText, CheckCircle, Clock, AlertTriangle, DollarSign, Calendar, Code } from 'lucide-react';
import SourceExtractionViewerModal from './integrations/SourceExtractionViewerModal';

interface IpcValuationSheetProps {
  ipc?: any; // The selected IPC object
  contractParams?: any;
  onSave: (data: any) => void;
  onClose: () => void;
}

export default function IpcValuationSheet({ ipc, contractParams, onSave, onClose }: IpcValuationSheetProps) {
  // State for the document lifecycle
  const [status, setStatus] = useState(ipc?.status || 'Draft');
  const [valuationDate, setValuationDate] = useState(ipc?.valuation_date || '');
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  
  // State for the financial amounts (Stored in values_map.valuation to keep DB ingested data clean)
  const [grossClaimed, setGrossClaimed] = useState(ipc?.values_map?.valuation?.gross_claimed || 0);
  const [grossCertified, setGrossCertified] = useState(ipc?.values_map?.valuation?.gross_certified || 0);
  const [netAmountDue, setNetAmountDue] = useState(ipc?.values_map?.valuation?.net_amount_due || 0);
  const [isValuationEditing, setIsValuationEditing] = useState(ipc?.values_map?.valuation?.net_amount_due ? false : true);
  const [valuationError, setValuationError] = useState('');

  // State for payment lifecycle (Ledger-based)
  const [payments, setPayments] = useState<{date: string, amount: number}[]>(
    ipc?.values_map?.valuation?.payments?.filter((p: any) => p.amount > 0) || []
  );

  // Active New Payment Row State
  const [newPaymentAmount, setNewPaymentAmount] = useState<number | ''>('');
  const [newPaymentDate, setNewPaymentDate] = useState<string>('');

  // Derived calculations
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remainingBeforeNew = Math.max(0, netAmountDue - totalPaid);
  
  const currentNewAmount = Number(newPaymentAmount) || 0;
  const remainingAfterNew = Math.max(0, remainingBeforeNew - currentNewAmount);

  const derivedPaymentStatus = 
    totalPaid === 0 ? 'UNPAID' : 
    remainingBeforeNew === 0 ? 'PAID' : 'PARTIAL';

  const handleSaveValuationAmounts = () => {
      const ingestedNet = ipc?.net_amount_due || 0;
      if (netAmountDue !== ingestedNet) {
          setValuationError(`Validation Failed: The inputted Net Amount Due ($${netAmountDue}) does not match the ingested IPC database value ($${ingestedNet}).`);
      } else {
          setValuationError('');
          setIsValuationEditing(false);
      }
  };

  const handleSavePaymentRow = () => {
      if (currentNewAmount > 0 && newPaymentDate) {
          setPayments([...payments, { amount: currentNewAmount, date: newPaymentDate }]);
          setNewPaymentAmount('');
          setNewPaymentDate('');
      }
  };

  const handleRemoveHistorical = (index: number) => {
      setPayments(payments.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold font-lexend text-gray-900">IPC Certificate Details</h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Certificate No: {ipc?.certificate_number || 'New'}
            </p>
          </div>
          <div className="flex space-x-3">
            {ipc?.values_map?.extraction && (
              <button 
                onClick={() => setShowExtractionModal(true)} 
                className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl transition flex items-center space-x-1.5"
              >
                <Code className="w-3.5 h-3.5" />
                <span>View Source Extraction</span>
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition">
              Cancel
            </button>
            <button 
              onClick={() => onSave({
                status, valuation_date: valuationDate,
                payment_status: derivedPaymentStatus, 
                unpaid_amount: remainingBeforeNew, 
                values_map: { 
                    ...(ipc?.values_map || {}), 
                    valuation: { gross_claimed: grossClaimed, gross_certified: grossCertified, net_amount_due: netAmountDue, payments }
                }
              })} 
              className="px-5 py-2 bg-dark-teal-800 hover:bg-dark-teal-900 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
        
        {/* Body */}
        <div className="p-8 flex-1 overflow-y-auto space-y-8 bg-gray-50/30">
            
            <SourceExtractionViewerModal 
              show={showExtractionModal} 
              onClose={() => setShowExtractionModal(false)} 
              extractionData={ipc?.values_map?.extraction}
              certificateNumber={ipc?.certificate_number || 'New'}
            />
            
            {/* Section 1: Approval Lifecycle */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center"><FileText className="w-4 h-4 mr-2 text-dark-teal-600"/> 1. Certification & Approval</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">Approval Status</label>
                        <select 
                            value={status} 
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-dark-teal-500"
                        >
                            <option value="Draft">Draft (Preparing)</option>
                            <option value="Submitted">Submitted to Consultant</option>
                            <option value="Certified">Certified (Approved)</option>
                        </select>
                        <p className="text-[10px] text-gray-500 mt-1">Is this still a draft or has it been approved?</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">Valuation / Certified Date</label>
                        <input 
                            type="date" 
                            value={valuationDate}
                            onChange={(e) => setValuationDate(e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-dark-teal-500"
                        />
                    </div>
                </div>
            </div>

            {/* Section 2: Valuation Amounts */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center"><DollarSign className="w-4 h-4 mr-2 text-dark-teal-600"/> 2. Valuation Amounts</h3>
                    {!isValuationEditing ? (
                        <button onClick={() => setIsValuationEditing(true)} className="text-xs font-bold text-dark-teal-600 hover:text-dark-teal-800 px-3 py-1 bg-dark-teal-50 rounded-lg">
                            Edit Amounts
                        </button>
                    ) : (
                        <button 
                            onClick={handleSaveValuationAmounts} 
                            disabled={!grossClaimed || !grossCertified || !netAmountDue}
                            className="text-xs font-bold text-white bg-dark-teal-700 hover:bg-dark-teal-800 disabled:bg-gray-400 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg shadow-sm transition"
                        >
                            Save Amounts
                        </button>
                    )}
                </div>
                
                {valuationError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        {valuationError}
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">Gross Claimed</label>
                        {isValuationEditing ? (
                            <input type="number" value={grossClaimed} onChange={(e) => setGrossClaimed(Number(e.target.value))} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"/>
                        ) : (
                            <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800">${grossClaimed.toLocaleString()}</div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">Gross Certified</label>
                        {isValuationEditing ? (
                            <input type="number" value={grossCertified} onChange={(e) => setGrossCertified(Number(e.target.value))} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"/>
                        ) : (
                            <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800">${grossCertified.toLocaleString()}</div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-emerald-700 mb-2">Net Amount Due</label>
                        {isValuationEditing ? (
                            <input type="number" value={netAmountDue} onChange={(e) => setNetAmountDue(Number(e.target.value))} className="w-full p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-800"/>
                        ) : (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-black text-emerald-800">${netAmountDue.toLocaleString()}</div>
                        )}
                        <p className="text-[10px] text-gray-500 mt-1">Amount after taxes & retention</p>
                    </div>
                </div>
            </div>

            {/* Section 3: Payment Lifecycle (Auto-expanding) */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                {derivedPaymentStatus === 'PAID' && <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>}
                <h3 className="text-sm font-bold text-gray-800 mb-6 flex items-center justify-between">
                    <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-dark-teal-600"/> 3. Payment Tracking</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                        derivedPaymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        derivedPaymentStatus === 'PARTIAL' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'
                    }`}>
                        {derivedPaymentStatus === 'PAID' ? 'FULLY PAID' : derivedPaymentStatus === 'PARTIAL' ? 'PARTIALLY PAID' : 'UNPAID'}
                    </span>
                </h3>

                <div className="space-y-6">
                    {/* Active Input Row (Only hides if fully paid off) */}
                    {!(totalPaid >= netAmountDue && netAmountDue > 0) && (
                        <div className="bg-gray-50 border-2 border-dark-teal-100 p-5 rounded-2xl">
                            <h4 className="text-xs font-bold text-dark-teal-800 uppercase tracking-wider mb-4">Record New Payment</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-2">Amount Paid</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-gray-400 font-bold">$</span>
                                        <input 
                                            type="number" 
                                            value={newPaymentAmount}
                                            onChange={(e) => setNewPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                            placeholder="0.00"
                                            className="w-full p-2.5 pl-7 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-dark-teal-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-2">Date of Payment</label>
                                    <input 
                                        type="date" 
                                        value={newPaymentDate}
                                        onChange={(e) => setNewPaymentDate(e.target.value)}
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-dark-teal-500"
                                    />
                                </div>
                                <div className="bg-white p-2.5 rounded-xl border border-red-100 flex flex-col justify-center">
                                    <label className="block text-[10px] font-bold text-red-700 uppercase tracking-wide">Remaining Unpaid</label>
                                    <span className="text-lg font-black text-red-600">${remainingAfterNew.toLocaleString()}</span>
                                </div>
                                <div>
                                    <button 
                                        onClick={handleSavePaymentRow}
                                        disabled={!newPaymentAmount || !newPaymentDate || currentNewAmount <= 0}
                                        className="w-full p-3 bg-dark-teal-800 hover:bg-dark-teal-900 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl transition shadow-md"
                                    >
                                        Save Row
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Historical Payments Saved Below */}
                    {payments.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Payment History Ledger</h4>
                            {payments.map((payment, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-6 p-4 bg-white border border-gray-100 shadow-sm rounded-xl items-center relative">
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Amount Paid</p>
                                        <p className="text-sm font-bold text-emerald-700">${payment.amount.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Date</p>
                                        <p className="text-sm font-bold text-gray-800">{payment.date}</p>
                                    </div>
                                    <div>
                                        {/* Empty column to match grid alignment */}
                                    </div>
                                    <div className="text-right">
                                        <button onClick={() => handleRemoveHistorical(index)} className="text-red-400 hover:text-red-600 text-[10px] uppercase font-bold px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition">
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </div>

        {/* Modal Footer (Summary) */}
        <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
            <div className="flex space-x-12">
                <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Net Amount Due</p>
                    <p className="text-xl font-black text-gray-900">${netAmountDue.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Paid So Far</p>
                    <p className="text-xl font-black text-emerald-600">${totalPaid.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Remaining Unpaid</p>
                    <p className={`text-xl font-black ${remainingBeforeNew > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        ${remainingBeforeNew.toLocaleString()}
                    </p>
                </div>
            </div>
            <div>
                 {derivedPaymentStatus === 'PAID' && (
                     <div className="flex items-center text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-xl">
                         <CheckCircle className="w-4 h-4 mr-2" />
                         IPC Fully Paid
                     </div>
                 )}
            </div>
        </div>

      </div>
    </div>
  );
}
