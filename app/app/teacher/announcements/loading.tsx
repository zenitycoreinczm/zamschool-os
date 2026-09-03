import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function AnnouncementsLoading() {
  return (
    <PageSkeleton
      variant="list"
      label="Loading announcements"
      className="p-4 md:p-6"
    />
  );
}
