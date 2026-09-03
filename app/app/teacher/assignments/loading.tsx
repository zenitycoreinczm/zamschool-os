import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function AssignmentsLoading() {
  return (
    <PageSkeleton
      variant="list"
      label="Loading assignments"
      className="p-4 md:p-6"
    />
  );
}
