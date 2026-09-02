import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authenticatedFetch } from './auth';
import { TEAM_ID } from './api';
type TeamContextValue = { teamId: string; loading: boolean; setPrimaryTeam(teamId: string): Promise<void>; refresh(): Promise<void> };
const TeamContext = createContext<TeamContextValue | null>(null);
export function TeamProvider({ children }: PropsWithChildren) {
  const [teamId, setTeamId] = useState(TEAM_ID), [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { try { const r=await authenticatedFetch('/api/user/home'); const b=await r.json(); if(r.ok&&b.personalization?.primaryTeam?.teamId)setTeamId(b.personalization.primaryTeam.teamId); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const setPrimaryTeam = useCallback(async (next:string) => { const r=await authenticatedFetch('/api/user/team-follows/primary',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({teamId:next})}); if(!r.ok)throw new Error('Unable to change your team.'); setTeamId(next); },[]);
  const value=useMemo(()=>({teamId,loading,setPrimaryTeam,refresh}),[teamId,loading,setPrimaryTeam,refresh]);
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
export function useTeam(){const value=useContext(TeamContext);if(!value)throw new Error('useTeam must be used inside TeamProvider.');return value;}
