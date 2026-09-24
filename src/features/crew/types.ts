export type CrewMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  weeklyYards: number;
  lifetimeYards: number;
  joinedAt?: string | null;
};
export type CrewComment = {
  id: string;
  message: string;
  createdAt: string;
  actorName: string | null;
  actorAvatar: string | null;
};
export type CrewActivity = {
  id: string;
  type: string;
  contentId: string | null;
  contentType: string | null;
  href: string | null;
  message: string | null;
  metadata: { title?: string; photoUrl?: string };
  createdAt: string;
  actorName: string | null;
  actorAvatar?: string | null;
  actorUserId?: string | null;
  reactions: Array<{ reaction: string; userId: string }>;
  comments?: CrewComment[];
};
export type Crew = {
  id: string;
  name: string;
  teamAbbr: string;
  ownerUserId: string;
  ownerName?: string;
  role: string;
  weeklyYards: number;
  rank: number;
  createdAt?: string;
  photoUrl?: string | null;
  members: CrewMember[];
  activity: CrewActivity[];
  pendingInvites: Array<{
    id: string;
    channel: string;
    deliveryState: string;
    recipientHint: string | null;
  }>;
};
