import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function ReportCardsLoading() {
  return (
    <PageSkeleton
      variant="form"
      label="Loading report cards"
      className="p-4 md:p-6"
    />
  );
}
