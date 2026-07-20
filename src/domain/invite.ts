export interface Invite {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  token: string;
  status: InviteStatus;
  invitedBy: string;
  createdAt: string;
  acceptedAt?: string;
}

export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";
