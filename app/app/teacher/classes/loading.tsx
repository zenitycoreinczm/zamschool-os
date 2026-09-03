import { PageSkeleton } from "@/components/workspace/PageSkeleton";

export default function ClassesLoading() {
  return (
    <PageSkeleton
      variant="list"
      label="Loading classes"
      className="p-4 md:p-6"
    />
  );
}
