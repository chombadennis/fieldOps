import { Project } from "@/models/project";
import { Building2, MapPin, Calendar, Layers } from 'lucide-react';

interface ProjectDetailsProps {
  project: Project;
}

export default function ProjectDetails({ project }: ProjectDetailsProps) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-md border border-gray-100 relative overflow-hidden">
      {/* Decorative Gradient Bar */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-dark-teal-700 via-crimson-violet-600 to-princeton-orange-500" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-dark-teal-50 text-dark-teal-800 text-xs font-bold rounded-full border border-dark-teal-100 flex items-center">
              <Building2 className="w-3.5 h-3.5 mr-1 text-dark-teal-600" /> Active Workspace
            </span>
            {project.location && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1 text-gray-500" /> {project.location}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold font-lexend text-gray-900 tracking-tight">
            {project.name}
          </h1>

          {project.description && (
            <p className="mt-2 text-sm text-gray-600 max-w-3xl leading-relaxed">
              {project.description}
            </p>
          )}
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
          <div className="text-right px-2">
            <p className="text-[10px] uppercase font-bold text-gray-400">Attached BoQs</p>
            <p className="text-lg font-black font-lexend text-dark-teal-800">{project.boq_documents?.length || 0}</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-right px-2">
            <p className="text-[10px] uppercase font-bold text-gray-400">Cloud Sources</p>
            <p className="text-lg font-black font-lexend text-crimson-violet-700">{project.integrations?.length || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
