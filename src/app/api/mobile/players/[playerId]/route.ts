import { NextRequest, NextResponse } from 'next/server';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { listPublicStories } from '@/server/story-engine/projections';
export async function GET(_:NextRequest,{params}:{params:{playerId:string}}){
 const player=NFL_LEAGUE_DATA.players.find(item=>item.id===params.playerId);if(!player)return NextResponse.json({error:'Player not found.'},{status:404});
 const contract=NFL_LEAGUE_DATA.contracts.find(item=>item.playerId===player.id&&item.teamAbbr===player.teamAbbr)??null;
 const stories=(await listPublicStories(player.teamAbbr,50)).filter(story=>`${story.headline} ${story.shortSummary} ${story.whatHappened}`.toLowerCase().includes(player.name.toLowerCase())).slice(0,6).map(story=>({id:story.id,headline:story.headline,summary:story.shortSummary,status:story.status,updatedAt:story.lastMeaningfulUpdateAt}));
 return NextResponse.json({player,contract,stories});
}
