import { Role } from "@/domain/types";
import { OrganizationService } from "@/domain/services/organization.service";

const STAFF_ROLES = [Role.Owner, Role.Admin, Role.Moderator, Role.Referee];
const ADMIN_ROLES = [Role.Owner, Role.Admin];

export async function getMemberRole(memberId: string, orgId: string): Promise<Role | null> {
  try {
    const orgSvc = new OrganizationService();
    const orgMembers = await orgSvc.getMembers(orgId);
    const found = orgMembers.find(m => m.member?.id === memberId);
    return found?.role ?? null;
  } catch {
    return null;
  }
}

export async function canEditMatches(memberId: string, orgId: string): Promise<boolean> {
  const role = await getMemberRole(memberId, orgId);
  return role !== null && STAFF_ROLES.includes(role);
}

export async function canManageCompetition(memberId: string, orgId: string): Promise<boolean> {
  const role = await getMemberRole(memberId, orgId);
  return role !== null && ADMIN_ROLES.includes(role);
}
