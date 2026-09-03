import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function InboxLoading() {
  return (
    <PageSkeleton
      variant="list"
      label="Loading messages"
      className="p-4 md:p-6"
    />
  );
}
