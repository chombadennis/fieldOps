import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* ProjectDetails Skeleton */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6 mt-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* UploadBOQ Skeleton */}
        <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
          <Skeleton className="h-7 w-1/2 mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Report Skeleton */}
        <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
          <Skeleton className="h-7 w-1/2 mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}