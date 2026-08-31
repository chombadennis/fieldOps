'use client';

import Link from 'next/link';
import { Project } from '@/models/project';
import { Building2, FileSpreadsheet, ArrowRight, ChevronRight } from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
}

export default function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <div
          key={project.id}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-neon-cyan/50 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(0,243,255,0.2)] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
        >
          {/* Top Accent Strip */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-neon-cyan via-white to-neon-purple opacity-80 group-hover:opacity-100 transition-opacity" />

          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-black/40 text-white rounded-2xl border border-white/10 group-hover:border-neon-cyan/50 group-hover:text-neon-cyan transition-colors duration-300">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 text-[11px] font-bold rounded-full shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                Active Project
              </span>
            </div>

            <Link href={`/dashboard/${project.id}`} className="block group/link">
              <h3 className="text-xl font-bold font-lexend text-white group-hover/link:text-neon-cyan transition-colors tracking-tight flex items-center drop-shadow-md">
                {project.name}
                <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover/link:opacity-100 group-hover/link:translate-x-1 transition-all" />
              </h3>
            </Link>

            <p className="mt-2 text-xs text-gray-400 line-clamp-2 leading-relaxed">
              {project.description || 'No description provided for this construction project workspace.'}
            </p>

            {/* Contracts Display */}
            {project.contracts && project.contracts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {project.contracts.map((contract: any) => (
                  <span 
                    key={contract.id} 
                    className="px-2 py-1 bg-white/5 text-gray-300 border border-white/10 text-[10px] font-medium rounded-md group-hover:border-white/20 transition-colors"
                    title={contract.name}
                  >
                    {contract.contract_type.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[11px] font-medium text-gray-500">
              <FileSpreadsheet className="w-3.5 h-3.5 text-neon-purple" />
              <span>{(project.boq_documents || []).filter((d: any) => !d.preview_only && d.validation_status !== 'rejected').length} BoQs Linked</span>
            </div>

            <Link
              href={`/dashboard/${project.id}`}
              className="inline-flex items-center text-xs font-bold text-neon-cyan hover:text-white group-hover:translate-x-1 transition-all drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]"
            >
              Open Workspace <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
