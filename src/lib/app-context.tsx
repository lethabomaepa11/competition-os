"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { type Organization, type Member } from "../domain/organization";
import {
  OrganizationService,
  MemberService,
} from "../domain/services/organization.service";

interface AppState {
  currentMember: Member | null;
  currentOrg: Organization | null;
  organizations: Organization[];
  members: Member[];
  ready: boolean;
}

interface AppContextType extends AppState {
  logout: () => Promise<void>;
  selectOrg: (org: Organization) => void;
  createOrg: (name: string, slug: string) => Promise<Organization>;
  refreshOrgs: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

const orgSvc = new OrganizationService();
const memberSvc = new MemberService();

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    currentMember: null,
    currentOrg: null,
    organizations: [],
    members: [],
    ready: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const json = await res.json();
        const session = json.data;
        if (session?.user) {
          const { id, email, displayName } = session.user;
          const existing = await memberSvc.getByEmail(email);
          if (existing) {
            const [members, organizations] = await Promise.all([
              memberSvc.list(),
              orgSvc.list(),
            ]);
            setState({
              currentMember: existing,
              currentOrg: null,
              members,
              organizations,
              ready: true,
            });
          } else {
            const member = await memberSvc.create({
              email,
              displayName: displayName ?? email,
              id,
            });
            const [members, organizations] = await Promise.all([
              memberSvc.list(),
              orgSvc.list(),
            ]);
            setState({
              currentMember: member,
              currentOrg: null,
              members,
              organizations,
              ready: true,
            });
          }
        } else {
          setState((s) => ({ ...s, ready: true }));
        }
      } catch {
        setState((s) => ({ ...s, ready: true }));
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setState({
      currentMember: null,
      currentOrg: null,
      organizations: [],
      members: [],
      ready: false,
    });
  }, []);

  const selectOrg = useCallback((org: Organization) => {
    setState((prev) => ({ ...prev, currentOrg: org }));
  }, []);

  const createOrg = useCallback(async (name: string, slug: string) => {
    const org = await orgSvc.create({ name, slug });
    setState((prev) => ({ ...prev, organizations: [], currentOrg: org }));
    const orgs = await orgSvc.list();
    setState((prev) => ({ ...prev, organizations: orgs }));
    return org;
  }, []);

  const refreshOrgs = useCallback(async () => {
    setState((prev) => ({ ...prev, organizations: [] }));
    const orgs = await orgSvc.list();
    setState((prev) => ({ ...prev, organizations: orgs }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        logout,
        selectOrg,
        createOrg,
        refreshOrgs,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
