import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function StudentsLoading() {
  return (
    <PageSkeleton
      variant="list"
      label="Loading students"
      className="p-4 md:p-6"
    />
  );
}
