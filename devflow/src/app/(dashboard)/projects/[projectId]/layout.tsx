import type { ReactNode } from "react";
import { RealtimeProjectSync } from "@/components/shared/realtime-project-sync";

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <><RealtimeProjectSync projectId={projectId} />{children}</>;
}
