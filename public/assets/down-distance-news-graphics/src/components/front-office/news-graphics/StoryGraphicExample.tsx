import React from "react";
import { NewsGraphicShell } from "./NewsGraphicShell";

type Story = {
  type: "TRADE_RUMOR" | "INJURY" | "GAME_RECAP" | "CONTRACT" | "SIGNING" |
        "PLAYER_PERFORMANCE" | "DRAFT" | "STANDINGS" | "COACH" | "RUMOR";
  teamAbbr?: string;
  opponentAbbr?: string;
  playerName?: string;
  playerNumber?: string | number;
  position?: string;
  headline: string;
  subhead?: string;
  primaryColor?: string;
  secondaryColor?: string;
};

const bgMap: Record<Story["type"], string> = {
  TRADE_RUMOR: "/assets/front-office/news-graphics/backgrounds/grunge.svg",
  INJURY: "/assets/front-office/news-graphics/backgrounds/field.svg",
  GAME_RECAP: "/assets/front-office/news-graphics/backgrounds/stadium.svg",
  CONTRACT: "/assets/front-office/news-graphics/backgrounds/locker-room.svg",
  SIGNING: "/assets/front-office/news-graphics/backgrounds/tunnel.svg",
  PLAYER_PERFORMANCE: "/assets/front-office/news-graphics/backgrounds/playbook.svg",
  DRAFT: "/assets/front-office/news-graphics/backgrounds/tunnel.svg",
  STANDINGS: "/assets/front-office/news-graphics/backgrounds/stadium.svg",
  COACH: "/assets/front-office/news-graphics/backgrounds/locker-room.svg",
  RUMOR: "/assets/front-office/news-graphics/backgrounds/playbook.svg"
};

export function StoryGraphicExample({ story }: { story: Story }) {
  return (
    <NewsGraphicShell
      background={bgMap[story.type]}
      primary={story.primaryColor}
      secondary={story.secondaryColor}
      className="aspect-[16/9] rounded-xl p-6 flex flex-col justify-between"
    >
      <div>
        <span className="dd-news-graphic__label">{story.type.replaceAll("_", " ")}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-6 items-end">
        <div>
          {story.playerNumber && (
            <div className="dd-news-graphic__number text-[clamp(5rem,10vw,10rem)]">
              {story.playerNumber}
            </div>
          )}
          <h2 className="dd-news-graphic__headline text-[clamp(1.7rem,4vw,4.2rem)]">
            {story.headline}
          </h2>
          {story.subhead && <p className="dd-news-graphic__muted mt-3">{story.subhead}</p>}
        </div>

        {story.teamAbbr && (
          <div className="dd-news-graphic__team-abbr text-4xl">
            {story.teamAbbr}
          </div>
        )}
      </div>
    </NewsGraphicShell>
  );
}
