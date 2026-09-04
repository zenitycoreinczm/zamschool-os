import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function IctRecoveryLoading() {
  return (
    <PageSkeleton
      variant="list"
      label="Loading user recovery"
      className="p-4 md:p-6"
    />
  );
}
