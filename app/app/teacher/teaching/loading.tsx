import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function TeachingLoading() {
  return (
    <PageSkeleton
      variant="list"
      label="Loading schedule"
      className="p-4 md:p-6"
    />
  );
}
