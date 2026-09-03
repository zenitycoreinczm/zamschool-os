import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function DisciplineLoading() {
  return (
    <PageSkeleton
      variant="list"
      label="Loading conduct records"
      className="p-4 md:p-6"
    />
  );
}
