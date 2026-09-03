import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function ProfileLoading() {
  return (
    <PageSkeleton
      variant="detail"
      label="Loading profile"
      className="p-4 md:p-6"
    />
  );
}
