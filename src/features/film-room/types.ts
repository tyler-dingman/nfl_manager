export type FilmRoomCategory =
  | 'press-conferences'
  | 'film-room'
  | 'podcasts'
  | 'local-shows'
  | 'player-interviews'
  | 'fan-creators';

export type CuratedFilmRoomVideo = {
  teamId: string;
  videoId: string;
  category: FilmRoomCategory;
  score: number;
  addedAt: string;
};

export type FilmRoomVideo = {
  id: string;
  category: FilmRoomCategory;
  score: number;
  addedAt: string;
  title: string;
  description: string | null;
  thumbnail: string;
  duration: string;
  publishedAt: string | null;
  viewCount: number | null;
  channel: {
    id: string;
    name: string;
    avatar: string | null;
    subscriberCount: number | null;
  };
  youtubeUrl: string;
  embedUrl: string;
  channelUrl: string;
};

export type FilmRoomResponse = {
  teamId: string;
  videos: FilmRoomVideo[];
  unavailableVideoIds: string[];
  configured: boolean;
  message?: string;
};
