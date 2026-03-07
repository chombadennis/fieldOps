import { Project } from "@/models/project";

interface ProjectDetailsProps {
  project: Project;
}

export default function ProjectDetails({ project }: ProjectDetailsProps) {
  return (
    <header className="bg-white shadow-md rounded-lg p-6">
      <h1 className="text-3xl font-bold text-gray-800">{project.name}</h1>
      <p className="mt-2 text-gray-600">{project.description}</p>
    </header>
  );
}
