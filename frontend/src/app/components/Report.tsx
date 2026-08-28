'use client';

interface ReportProps {
  projectId: string;
}

export default function Report({ projectId }: ReportProps) {
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <h2 className="text-2xl font-bold font-lexend text-white mb-4 drop-shadow-md">Project Report</h2>
      <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
        <p>This section will display the project report, including progress, budget, and other key metrics.</p>
        <p>Future development will populate this area with dynamic data and visualizations, providing a comprehensive overview of the project's status.</p>
      </div>
    </div>
  );
}
