export interface ParticipantInvite {
  id: string;
  eventId: string;
  competitionId: string;
  email: string;
  displayName: string;
  token: string;
  status: "pending" | "accepted" | "revoked";
  invitedBy: string;
  createdAt: string;
  acceptedAt?: string;
}
