'use client';

import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  BadgeDollarSign,
  ClipboardCheck,
  Handshake,
  Plus,
  UserX,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PlayerRowDTO } from '@/types/player';

export type PlayerRowActionsVariant = 'roster' | 'freeAgent' | 'draft' | 'tradePicker' | 'resign';

type ActionConfig = {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
};

type PlayerRowActionsProps = {
  player: PlayerRowDTO;
  variant: PlayerRowActionsVariant;
  onTheClockForUserTeam?: boolean;
  onCutPlayer?: (player: PlayerRowDTO) => void;
  onTradePlayer?: (player: PlayerRowDTO) => void;
  onOfferPlayer?: (player: PlayerRowDTO) => void;
  onDraftPlayer?: (player: PlayerRowDTO) => void;
  onResignPlayer?: (player: PlayerRowDTO) => void;
  onRenegotiatePlayer?: (player: PlayerRowDTO) => void;
  onSelectTradePlayer?: (player: PlayerRowDTO) => void;
};

const getPlayerName = (player: PlayerRowDTO) => `${player.firstName} ${player.lastName}`;

const getDraftDisabledReason = (
  player: PlayerRowDTO,
  onTheClockForUserTeam?: boolean,
): string | undefined => {
  if (player.isDrafted) {
    return 'Prospect already drafted.';
  }

  if (!onTheClockForUserTeam) {
    return 'Not on the clock.';
  }

  return undefined;
};

export default function PlayerRowActions({
  player,
  variant,
  onTheClockForUserTeam,
  onCutPlayer,
  onTradePlayer,
  onOfferPlayer,
  onDraftPlayer,
  onResignPlayer,
  onRenegotiatePlayer,
  onSelectTradePlayer,
}: PlayerRowActionsProps) {
  const name = getPlayerName(player);
  const draftDisabledReason = getDraftDisabledReason(player, onTheClockForUserTeam);
  const isCut = player.status.toLowerCase() === 'cut';
  const cutDisabledReason = isCut ? 'Player has been cut.' : undefined;
  const actions: ActionConfig[] =
    variant === 'roster'
      ? [
          {
            label: 'Cut',
            icon: UserX,
            onClick: () => onCutPlayer?.(player),
            disabled: isCut,
            disabledReason: cutDisabledReason,
          },
          {
            label: 'Renegotiate',
            icon: BadgeDollarSign,
            onClick: () => onRenegotiatePlayer?.(player),
            disabled: isCut,
            disabledReason: cutDisabledReason,
          },
          {
            label: 'Trade',
            icon: ArrowLeftRight,
            onClick: () => onTradePlayer?.(player),
            disabled: isCut,
            disabledReason: cutDisabledReason,
          },
        ]
      : variant === 'freeAgent'
        ? [
            {
              label: 'Offer',
              icon: Handshake,
              onClick: () => onOfferPlayer?.(player),
              disabled: player.status.toLowerCase() === 'signed',
              disabledReason:
                player.status.toLowerCase() === 'signed' ? 'Already signed.' : undefined,
            },
          ]
        : variant === 'draft'
          ? [
              {
                label: 'Draft',
                icon: ClipboardCheck,
                onClick: () => onDraftPlayer?.(player),
                disabled: Boolean(draftDisabledReason),
                disabledReason: draftDisabledReason,
              },
            ]
          : variant === 'resign'
            ? [
                {
                  label: 'Re-sign',
                  icon: Handshake,
                  onClick: () => onResignPlayer?.(player),
                },
              ]
            : [
                {
                  label: 'Add asset',
                  icon: Plus,
                  onClick: () => onSelectTradePlayer?.(player),
                },
              ];

  return (
    <div className="flex flex-col items-end justify-end gap-1.5 md:flex-row md:items-center md:gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        const isDisabled = Boolean(action.disabled);
        const button = (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:h-8 md:w-8"
            onClick={action.onClick}
            aria-label={`${action.label} ${name}`}
            disabled={isDisabled}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );

        if (action.disabledReason) {
          return (
            <span key={action.label} className="inline-flex" title={action.disabledReason}>
              {button}
            </span>
          );
        }

        return (
          <span key={action.label} className="inline-flex">
            {button}
          </span>
        );
      })}
    </div>
  );
}
