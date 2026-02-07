'use client';

import ContractOfferModal from '@/components/contract-offer-modal';
import type { PlayerRowDTO } from '@/types/player';

type ResignPlayerModalProps = {
  player: PlayerRowDTO;
  isOpen: boolean;
  expectedApyOverride?: number;
  onClose: () => void;
  onSubmit: (offer: { years: number; apy: number; guaranteed: number }) => Promise<void>;
};

export default function ResignPlayerModal({
  player,
  isOpen,
  expectedApyOverride,
  onClose,
  onSubmit,
}: ResignPlayerModalProps) {
  return (
    <ContractOfferModal
      player={player}
      isOpen={isOpen}
      title={`Re-sign ${player.firstName} ${player.lastName}`}
      subtitle="Set contract terms and keep the core together."
      expectedApyOverride={expectedApyOverride}
      onClose={onClose}
      onSubmit={async (offer) => {
        await onSubmit(offer);
      }}
    />
  );
}
