import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function WorkspaceLoading() {
  return (
    <div className="px-1 py-2 md:px-0">
      <PageSkeleton variant="dashboard" label="Loading workspace" />
    </div>
  );
}
