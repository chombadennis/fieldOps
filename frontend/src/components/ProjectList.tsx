'use client';

import Link from 'next/link';
import { Project } from '@/models/project';
import { Building2, Calendar, FileSpreadsheet, ArrowRight, Trash2, Edit3, ChevronRight } from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
}

export default function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <div
          key={project.id}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1 relative overflow-hidden"
        >
          {/* Top Accent Strip */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-dark-teal-600 via-crimson-violet-600 to-princeton-orange-500 opacity-80 group-hover:opacity-100 transition-opacity" />

          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-dark-teal-50 text-dark-teal-700 rounded-2xl group-hover:bg-dark-teal-700 group-hover:text-white transition-colors duration-300">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-bold rounded-full">
                Active Project
              </span>
            </div>

            <Link href={`/dashboard/${project.id}`} className="block group/link">
              <h3 className="text-xl font-bold font-lexend text-gray-900 group-hover/link:text-crimson-violet-600 transition-colors tracking-tight flex items-center">
                {project.name}
                <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover/link:opacity-100 group-hover/link:translate-x-1 transition-all" />
              </h3>
            </Link>

            <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">
              {project.description || 'No description provided for this construction project workspace.'}
            </p>

            {/* Contracts Display */}
            {project.contracts && project.contracts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {project.contracts.map((contract: any) => (
                  <span 
                    key={contract.id} 
                    className="px-2 py-1 bg-gray-50 text-gray-600 border border-gray-200 text-[10px] font-medium rounded-md"
                    title={contract.name}
                  >
                    {contract.contract_type.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[11px] font-medium text-gray-400">
              <FileSpreadsheet className="w-3.5 h-3.5 text-dark-teal-600" />
              <span>{project.boq_documents?.length || 0} BoQs Linked</span>
            </div>

            <Link
              href={`/dashboard/${project.id}`}
              className="inline-flex items-center text-xs font-bold text-dark-teal-700 hover:text-dark-teal-900 group-hover:translate-x-1 transition-all"
            >
              Open Workspace <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
