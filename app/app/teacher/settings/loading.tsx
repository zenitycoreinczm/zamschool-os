import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function SettingsLoading() {
  return (
    <PageSkeleton
      variant="form"
      label="Loading settings"
      className="p-4 md:p-6"
    />
  );
}
