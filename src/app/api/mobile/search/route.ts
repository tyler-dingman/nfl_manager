import { NextRequest, NextResponse } from 'next/server';
import { TEAM_LIST } from '@/data/teams';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { listPublicStories } from '@/server/story-engine/projections';
import { loadTeamBriefings } from '@/server/content/team-briefings';
const storyPayload=(story:any)=>({id:story.id,title:story.headline,summary:story.whatHappened||story.shortSummary,whyItMatters:story.whyItMatters,whatsNext:story.whatsNext,status:story.status,importanceScore:story.importanceScore,lastMaterialUpdateAt:story.lastMeaningfulUpdateAt,sources:story.sources.map((source:any)=>({id:source.id,sourceName:source.name,sourceUrl:source.url,isOfficialSource:source.official}))});
export async function GET(request:NextRequest){
 const q=(request.nextUrl.searchParams.get('q')??'').trim().toLowerCase(),team=(request.nextUrl.searchParams.get('team')??'KC').toUpperCase();
 if(q.length<2)return NextResponse.json({stories:[],players:[]});
 if(!TEAM_LIST.some(item=>item.abbr===team))return NextResponse.json({error:'Unknown NFL team.'},{status:404});
 const [canonical,briefings,players]=await Promise.all([listPublicStories(team,50),loadTeamBriefings(team),Promise.resolve(NFL_LEAGUE_DATA.players.filter(player=>player.teamAbbr===team))]);
 const canonicalResults=canonical.filter(story=>`${story.headline} ${story.shortSummary} ${story.whatHappened} ${story.sources.map(s=>s.name).join(' ')}`.toLowerCase().includes(q)).map(story=>({id:story.id,headline:story.headline,status:story.status,teamId:story.teamId,updatedAt:story.lastMeaningfulUpdateAt,source:story.primarySource?.name??null,story:storyPayload(story)}));
 const known=new Set(canonicalResults.map(item=>item.id));
 const briefingResults=briefings.filter(item=>!known.has(item.id)&&`${item.headline} ${item.summary} ${item.category} ${item.sources.map(source=>source.publisher).join(' ')}`.toLowerCase().includes(q)).map(item=>({id:item.id,headline:item.headline,status:item.category.toUpperCase(),teamId:team,updatedAt:item.updatedAt,source:item.sources[0]?.publisher??null,story:{id:item.id,title:item.headline,summary:item.summary,whyItMatters:item.whyItMatters??'',whatsNext:'Follow the linked reporting for the next verified update.',status:item.category.toUpperCase(),importanceScore:70,lastMaterialUpdateAt:item.updatedAt,sources:item.sources.map(source=>({id:source.id,sourceName:source.publisher,sourceUrl:source.url,isOfficialSource:source.kind==='official'}))}}));
 return NextResponse.json({stories:[...canonicalResults,...briefingResults].slice(0,12),players:players.filter(player=>`${player.name} ${player.position} ${player.teamAbbr}`.toLowerCase().includes(q)).slice(0,15).map(player=>({id:player.id,name:player.name,position:player.position,teamAbbr:player.teamAbbr,headshotUrl:player.headshotUrl}))});
}
