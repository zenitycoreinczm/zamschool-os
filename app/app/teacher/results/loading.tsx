import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function ResultsLoading() {
  return (
    <PageSkeleton
      variant="split"
      label="Loading results"
      className="p-4 md:p-6"
    />
  );
}
