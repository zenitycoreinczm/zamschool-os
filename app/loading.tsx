import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";

export default function Loading() {
  return (
    <WorkspaceLoader
      label="Loading ZamSchool"
      hint="Getting things ready"
      compact
    />
  );
}
