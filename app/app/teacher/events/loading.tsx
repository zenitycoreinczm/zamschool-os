import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function EventsLoading() {
  return (
    <PageSkeleton
      variant="list"
      label="Loading events"
      className="p-4 md:p-6"
    />
  );
}
