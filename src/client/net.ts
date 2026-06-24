/** Typed fetch helpers for the INKDROP server API. */

import type {
  ArchiveResponse,
  CampaignClearResponse,
  CampaignResponse,
  DistributionResponse,
  EquipRequest,
  EquipResponse,
  ForgeGhostsResponse,
  ForgeListResponse,
  ForgeReportResponse,
  ForgeSort,
  ForgeSubmitRequest,
  ForgeSubmitResponse,
  ForgeVoteResponse,
  GhostsResponse,
  InitResponse,
  LeaderboardResponse,
  LeaderboardScope,
  NotifyStatusResponse,
  PresenceResponse,
  ProfileResponse,
  ShareResponse,
  Solution,
  SolveResponse,
} from '../shared/api';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}`);
  return (await res.json()) as T;
}

export const net = {
  init: () => getJson<InitResponse>('/api/init'),
  solve: (sol: Solution) => postJson<SolveResponse>('/api/solve', sol),
  ghosts: (limit = 6) => getJson<GhostsResponse>(`/api/ghosts?limit=${limit}`),
  leaderboard: (scope: LeaderboardScope = 'today', limit = 20) =>
    getJson<LeaderboardResponse>(`/api/leaderboard?scope=${scope}&limit=${limit}`),
  archive: (limit = 14) => getJson<ArchiveResponse>(`/api/archive?limit=${limit}`),
  distribution: () => getJson<DistributionResponse>('/api/distribution'),
  forgeList: (sort: ForgeSort = 'top', limit = 20) =>
    getJson<ForgeListResponse>(`/api/forge/list?sort=${sort}&limit=${limit}`),
  forgeSubmit: (req: ForgeSubmitRequest) =>
    postJson<ForgeSubmitResponse>('/api/forge/submit', req),
  forgeVote: (id: string) => postJson<ForgeVoteResponse>('/api/forge/vote', { id }),
  forgeReport: (id: string) => postJson<ForgeReportResponse>('/api/forge/report', { id }),
  forgeGhosts: (forgeId: string) =>
    getJson<ForgeGhostsResponse>(`/api/forge/ghosts?forgeId=${encodeURIComponent(forgeId)}`),
  forgeGhost: (forgeId: string, strokes: number[][]) =>
    postJson<{ ok: boolean }>('/api/forge/ghost', { forgeId, strokes }),
  share: (text: string) => postJson<ShareResponse>('/api/share', { text }),
  profile: () => getJson<ProfileResponse>('/api/profile'),
  equip: (req: EquipRequest) => postJson<EquipResponse>('/api/profile/equip', req),
  presence: () => postJson<PresenceResponse>('/api/presence', {}),
  notifyStatus: () => getJson<NotifyStatusResponse>('/api/notify'),
  notifyToggle: (on: boolean) => postJson<NotifyStatusResponse>('/api/notify/toggle', { on }),
  campaign: () => getJson<CampaignResponse>('/api/campaign'),
  campaignClear: (level: number, stars: number) =>
    postJson<CampaignClearResponse>('/api/campaign/clear', { level, stars }),
};
