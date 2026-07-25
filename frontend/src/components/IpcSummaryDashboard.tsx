import React from 'react';
import { TrendingUp, FileText, DollarSign, Activity, AlertCircle } from 'lucide-react';

interface IpcSummaryProps {
  summaryMetrics?: {
    total_certified: number;
    total_outstanding_unpaid: number;
    pending_claims: number;
    ipcs_count: number;
  };
  contractMetrics?: {
    contract_sum: number;
    revised_contract_sum: number;
    retention_held: number;
    max_retention: number;
    advance_paid: number;
    advance_recovered: number;
  };
}

export default function IpcSummaryDashboard({ summaryMetrics, contractMetrics }: IpcSummaryProps) {
  const metrics = summaryMetrics || {
    total_certified: 0,
    total_outstanding_unpaid: 0,
    pending_claims: 0,
    ipcs_count: 0
  };

  const cMetrics = contractMetrics || {
    contract_sum: 0,
    revised_contract_sum: 0,
    retention_held: 0,
    max_retention: 0,
    advance_paid: 0,
    advance_recovered: 0
  };

  const progressPercent = cMetrics.revised_contract_sum > 0 
    ? (metrics.total_certified / cMetrics.revised_contract_sum) * 100 
    : 0;

  const retentionPercent = cMetrics.max_retention > 0
    ? (cMetrics.retention_held / cMetrics.max_retention) * 100
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Contract Progress */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
              {progressPercent.toFixed(1)}% Billed
            </span>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Net Certified</p>
          <h3 className="text-xl font-bold font-lexend text-gray-900 mt-1">
            KSh {metrics.total_certified.toLocaleString()}
          </h3>
          <p className="text-[11px] text-gray-400 font-medium mt-2">
            of Revised Sum KSh {cMetrics.revised_contract_sum.toLocaleString()}
          </p>
        </div>

        {/* Outstanding Unpaid */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
          {metrics.total_outstanding_unpaid > 0 && (
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full -z-0"></div>
          )}
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide relative z-10">Unpaid Overdue Balance</p>
          <h3 className="text-xl font-bold font-lexend text-red-600 mt-1 relative z-10">
            KSh {metrics.total_outstanding_unpaid.toLocaleString()}
          </h3>
          <p className="text-[11px] text-gray-400 font-medium mt-2 relative z-10">
            Cumulative across all unpaid IPCs
          </p>
        </div>

        {/* Retention Escrow */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Retention Withheld</p>
          <h3 className="text-xl font-bold font-lexend text-gray-900 mt-1">
            KSh {cMetrics.retention_held.toLocaleString()}
          </h3>
          
          <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${Math.min(retentionPercent, 100)}%` }}></div>
          </div>
          <p className="text-[11px] text-gray-400 font-medium mt-1.5">
            Cap: KSh {cMetrics.max_retention.toLocaleString()}
          </p>
        </div>

        {/* Pending Claims */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending Draft Claims</p>
          <h3 className="text-xl font-bold font-lexend text-gray-900 mt-1">
            KSh {metrics.pending_claims.toLocaleString()}
          </h3>
          <p className="text-[11px] text-gray-400 font-medium mt-2">
            Waiting for certification
          </p>
        </div>
      </div>
    </div>
  );
}
