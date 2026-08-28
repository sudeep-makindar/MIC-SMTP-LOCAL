import type { CampaignStatus } from "@shared/types";

const LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  sending: "Sending",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
  interrupted: "Interrupted",
  cancelled: "Cancelled",
};

export default function StatusBadge({ status }: { status: CampaignStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>;
}
