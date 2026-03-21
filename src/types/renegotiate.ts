import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';

export type RenegotiateResultDTO = {
  ok: true;
  accepted: boolean;
  score: number;
  label: string;
  quote: string;
  player?: PlayerRowDTO;
  header?: SaveHeaderDTO;
};
