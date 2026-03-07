import Link from 'next/link';
import { Project } from '@/models/project';

interface ProjectListProps {
  projects: Project[];
}

export default function ProjectList({ projects }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center bg-white shadow-md rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800">No Projects Found</h2>
        <p className="mt-2 text-gray-600">Get started by creating a new project.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <div key={project.id} className="bg-white shadow-md rounded-lg p-6 flex flex-col justify-between">
          <div>
            <Link href={`/dashboard/${project.id}`}>
              <h3 className="text-xl font-bold text-gray-800 hover:text-crimson-violet-600 transition-colors">{project.name}</h3>
            </Link>
            <p className="mt-2 text-gray-600 truncate">{project.description}</p>
          </div>
          <div className="mt-4 flex justify-end space-x-4">
            <button className="font-medium text-princeton-orange-600 hover:text-princeton-orange-700">Edit</button>
            <button className="font-medium text-deep-crimson-600 hover:text-deep-crimson-700">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
