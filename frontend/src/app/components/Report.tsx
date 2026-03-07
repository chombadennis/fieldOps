'use client';

interface ReportProps {
  projectId: string;
}

export default function Report({ projectId }: ReportProps) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Project Report</h2>
      <div className="text-gray-600">
        <p>This section will display the project report, including progress, budget, and other key metrics.</p>
        <p className="mt-4">Future development will populate this area with dynamic data and visualizations, providing a comprehensive overview of the project's status.</p>
      </div>
    </div>
  );
}
