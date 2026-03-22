import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';

export type FreeAgencyWave = 1 | 2 | 3;
export type FreeAgencyView = 'available' | 'userSigned' | 'signed';

export type FreeAgencyMarketDTO = {
  wave: FreeAgencyWave;
  waveLabel: string;
  originalPoolSize: number;
  availableCount: number;
  userSignedCount: number;
  cpuSignedCount: number;
  players: PlayerRowDTO[];
  header?: SaveHeaderDTO;
};
