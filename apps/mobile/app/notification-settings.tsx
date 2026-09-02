import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { getUserPreferences, updateUserPreferences, type UserPreferences } from '../lib/api';
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from '../lib/push';

const levels:{id:UserPreferences['intensity'];title:string;body:string}[]=[
  {id:'CASUAL',title:'THE HEADLINES',body:'Only major team developments.'},
  {id:'LOCKED_IN',title:'KEEP ME POSTED',body:'Major alerts plus intelligent catch-ups and recaps.'},
  {id:'SICKO',title:'EVERY SNAP',body:'Everything meaningful worth knowing.'},
];
export default function NotificationSettings(){
  const [selected,setSelected]=useState<UserPreferences['intensity']|null>(null),[pushState,setPushState]=useState<PushState|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null);
  useEffect(()=>{void Promise.all([getUserPreferences(),getPushState()]).then(([p,state])=>{setSelected(p.intensity);setPushState(state);}).catch(()=>setMessage('Unable to load notification settings.'));},[]);
  const togglePush=async(on:boolean)=>{setBusy(true);setMessage(null);try{setPushState(on?await enablePush():await disablePush());setMessage(on?'This iPhone is registered for D&D push notifications.':'Push delivery is disabled for this device.');}catch(e){const text=e instanceof Error?e.message:'Unable to update push notifications.';setMessage(text);setPushState(text.includes('Permission denied')?'denied':'disabled');}finally{setBusy(false);}};
  const choose=async(id:UserPreferences['intensity'])=>{setSelected(id);setBusy(true);setMessage(null);try{await updateUserPreferences({intensity:id});}catch{setMessage('Unable to save preference.');}finally{setBusy(false);}};
  const test=async()=>{setBusy(true);setMessage(null);try{const result=await sendTestPush();setMessage(`Test notification sent to ${result.delivered??1} device.`);}catch(e){setMessage(e instanceof Error?e.message:'Unable to send test notification.');}finally{setBusy(false);}};
  return <ScrollView style={s.page} contentContainerStyle={s.body}><Eyebrow>YOUR SIGNAL</Eyebrow><Heading>Notifications</Heading>
    <View style={s.pushCard}><View style={s.pushCopy}><Text style={s.title}>PUSH NOTIFICATIONS</Text><Text style={s.status}>{pushState===null?'Checking…':pushState==='enabled'?'Enabled':pushState==='denied'?'Permission Denied':pushState==='unavailable'?'Physical device required':'Disabled'}</Text></View>{pushState===null?<ActivityIndicator color={C.red}/>:<Switch disabled={busy||pushState==='unavailable'||pushState==='denied'} value={pushState==='enabled'} onValueChange={value=>void togglePush(value)} trackColor={{false:'#C9CED2',true:C.red}}/>}</View>
    {pushState==='denied'?<Pressable onPress={()=>void Linking.openSettings()}><Text style={s.settings}>OPEN IPHONE SETTINGS →</Text></Pressable>:null}
    {__DEV__?<Pressable disabled={busy||pushState==='unavailable'} style={[s.test,pushState==='unavailable'&&s.disabled]} onPress={()=>void test()}><Text style={s.testText}>SEND TEST NOTIFICATION</Text></Pressable>:null}
    {message?<Text style={s.message}>{message}</Text>:null}
    <Text style={s.section}>HOW CLOSELY ARE YOU FOLLOWING?</Text>{selected===null&&!message?<ActivityIndicator color={C.red}/>:levels.map(level=><Pressable key={level.id} disabled={busy} style={[s.card,selected===level.id&&s.selected]} onPress={()=>void choose(level.id)}><View style={[s.radio,selected===level.id&&s.radioOn]}/><View style={s.text}><Text style={s.title}>{level.title}</Text><Text style={s.copy}>{level.body}</Text></View></Pressable>)}
    {Platform.OS==='web'?<Text style={s.note}>Native push controls are available in the iPhone development build.</Text>:null}
  </ScrollView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:C.cream},body:{padding:20,paddingBottom:40},pushCard:{backgroundColor:C.white,borderRadius:17,padding:18,marginTop:22,flexDirection:'row',alignItems:'center'},pushCopy:{flex:1},status:{color:C.muted,fontSize:14,marginTop:5},settings:{color:C.red,fontWeight:'900',fontSize:13,marginTop:12},test:{backgroundColor:C.navy,borderRadius:14,padding:16,alignItems:'center',marginTop:12},disabled:{opacity:.4},testText:{color:C.white,fontSize:13,fontWeight:'900',letterSpacing:1},message:{color:C.muted,fontSize:14,lineHeight:20,marginTop:12},section:{color:C.ink,fontSize:13,fontWeight:'900',letterSpacing:1.2,marginTop:30,marginBottom:12},card:{backgroundColor:C.white,borderRadius:16,padding:18,marginBottom:10,flexDirection:'row',borderWidth:1,borderColor:'#E4DDD2'},selected:{borderColor:C.red,borderWidth:2},radio:{width:18,height:18,borderRadius:9,borderWidth:2,borderColor:C.muted,marginRight:14,marginTop:2},radioOn:{borderColor:C.red,backgroundColor:C.red},text:{flex:1},title:{color:C.ink,fontWeight:'900',fontSize:16},copy:{color:C.muted,fontSize:14,lineHeight:20,marginTop:4},note:{color:C.muted,fontSize:13,marginTop:12}});
