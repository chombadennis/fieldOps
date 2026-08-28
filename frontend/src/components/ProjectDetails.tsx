import { Project } from "@/models/project";
import { Building2, MapPin, Calendar, Layers } from 'lucide-react';

interface ProjectDetailsProps {
  project: Project;
}

export default function ProjectDetails({ project }: ProjectDetailsProps) {
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 relative overflow-hidden">
      {/* Decorative Gradient Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink shadow-[0_0_15px_rgba(0,243,255,0.5)]" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-neon-cyan/20 text-neon-cyan text-xs font-bold rounded-full border border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)] flex items-center">
              <Building2 className="w-3.5 h-3.5 mr-1 text-neon-cyan" /> Active Workspace
            </span>
            {project.location && (
              <span className="px-3 py-1 bg-white/10 text-gray-300 text-xs font-semibold rounded-full border border-white/10 flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1 text-gray-400" /> {project.location}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold font-lexend text-white drop-shadow-md tracking-tight">
            {project.name}
          </h1>

          {project.description && (
            <p className="mt-2 text-sm text-gray-300 max-w-3xl leading-relaxed">
              {project.description}
            </p>
          )}
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center space-x-3 bg-black/40 p-3 rounded-2xl border border-white/10 shadow-inner">
          <div className="text-right px-2">
            <p className="text-[10px] uppercase font-bold text-gray-500">Attached BoQs</p>
            <p className="text-lg font-black font-lexend text-neon-cyan drop-shadow-sm">{project.boq_documents?.length || 0}</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-right px-2">
            <p className="text-[10px] uppercase font-bold text-gray-500">Cloud Sources</p>
            <p className="text-lg font-black font-lexend text-neon-purple drop-shadow-sm">{project.integrations?.length || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
