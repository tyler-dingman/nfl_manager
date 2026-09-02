import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { C, Eyebrow, Heading } from '../components/screen';
import { getTeams, type TeamOption } from '../lib/api';
import { useTeam } from '../lib/team-context';
export default function TeamSelect(){
  const {teamId,setPrimaryTeam}=useTeam(); const [teams,setTeams]=useState<TeamOption[]>([]),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
  useEffect(()=>{getTeams().then(setTeams).catch(()=>setError('Unable to load teams.'));},[]);
  const choose=async(abbr:string)=>{setBusy(abbr);setError(null);try{await setPrimaryTeam(abbr);router.back();}catch(e){setError(e instanceof Error?e.message:'Unable to change team.');}finally{setBusy(null);}};
  return <ScrollView style={s.page} contentContainerStyle={s.body}><Eyebrow>PERSONALIZE D&amp;D</Eyebrow><Heading>Pick your team</Heading><Text style={s.copy}>This team follows your account across web and mobile.</Text>{!teams.length&&!error?<ActivityIndicator color={C.red}/>:null}{error?<Text style={s.error}>{error}</Text>:null}<View style={s.grid}>{teams.map(team=><Pressable key={team.abbr} style={[s.team,team.abbr===teamId&&{borderColor:team.colors[0],borderWidth:3}]} disabled={Boolean(busy)} onPress={()=>void choose(team.abbr)}><View style={[s.swatch,{backgroundColor:team.colors[0]}]}/><View style={s.teamText}><Text style={s.abbr}>{team.abbr}</Text><Text style={s.name}>{team.name}</Text></View>{busy===team.abbr?<ActivityIndicator color={team.colors[0]}/>:team.abbr===teamId?<Text style={s.current}>CURRENT</Text>:null}</Pressable>)}</View></ScrollView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:C.cream},body:{padding:20,paddingBottom:40},copy:{color:C.muted,fontSize:16,lineHeight:23,marginTop:10,marginBottom:20},error:{color:C.red,fontSize:14,marginVertical:16},grid:{gap:9},team:{backgroundColor:C.white,borderRadius:14,minHeight:68,padding:12,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#E4DDD2'},swatch:{width:12,height:40,borderRadius:8,marginRight:12},teamText:{flex:1},abbr:{color:C.ink,fontWeight:'900',fontSize:16},name:{color:C.muted,fontSize:14,marginTop:2},current:{color:C.red,fontSize:12,fontWeight:'900',letterSpacing:.8}});
