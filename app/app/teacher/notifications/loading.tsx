import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function NotificationsLoading() {
  return (
    <PageSkeleton
      variant="list"
      label="Loading notifications"
      className="p-4 md:p-6"
    />
  );
}
