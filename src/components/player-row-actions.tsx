'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  BadgeDollarSign,
  ClipboardCheck,
  Handshake,
  MoreHorizontal,
  Plus,
  UserX,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

  const mobileRosterActions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-[124px] justify-center gap-1.5 px-3 text-xs sm:hidden"
          aria-label={`Open actions for ${name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span>Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.label}
              onClick={(event) => {
                event.stopPropagation();
                action.onClick?.();
              }}
              disabled={Boolean(action.disabled)}
              title={action.disabledReason}
            >
              <Icon className="mr-2 h-4 w-4" />
              <span>{action.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className="flex flex-wrap items-center justify-start gap-1.5 sm:flex-nowrap sm:justify-end sm:gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      {variant === 'roster' ? mobileRosterActions : null}
      {actions.map((action) => {
        const Icon = action.icon;
        const isDisabled = Boolean(action.disabled);
        const button = (
          <>
            {variant !== 'roster' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-[124px] justify-center gap-1.5 px-3 text-xs sm:hidden"
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick?.();
                }}
                aria-label={`${action.label} ${name}`}
                disabled={isDisabled}
              >
                <Icon className="h-4 w-4" />
                <span>{action.label}</span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 sm:inline-flex"
              onClick={(event) => {
                event.stopPropagation();
                action.onClick?.();
              }}
              aria-label={`${action.label} ${name}`}
              disabled={isDisabled}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </>
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
