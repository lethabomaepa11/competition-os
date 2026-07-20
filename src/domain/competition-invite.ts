export interface CompetitionInvite {
  id: string;
  competitionId: string;
  organizationId: string;
  label: string;
  token: string;
  status: "active" | "disabled";
  createdBy: string;
  createdAt: string;
}
