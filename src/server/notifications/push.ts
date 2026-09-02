import { randomUUID } from 'node:crypto';
import { getPreferences } from '@/server/user/repository';
import { createNotification, invalidatePushToken, listDeliverablePushTokens, recordDelivery } from './repository';

export type PushMessage = { userId:string; title:string; body:string; destination:string; data?:Record<string,unknown> };
type ExpoTicket = {status:'ok';id:string}|{status:'error';message:string;details?:{error?:string}};

export async function sendPush(input:PushMessage) {
  const preferences = await getPreferences(input.userId);
  if (preferences?.pushEnabled === false) return {ok:false,suppressed:true,reason:'Push notifications are disabled.',delivered:0};
  const tokens = (await listDeliverablePushTokens(input.userId)).filter(token=>token.provider==='EXPO');
  if (!tokens.length) return {ok:false,reason:'No enabled device with a valid Expo push token.',delivered:0};
  const notification = await createNotification(input.userId,{eventId:`push:${randomUUID()}`,title:input.title,body:input.body,deepLink:input.destination});
  if (!notification) throw new Error('Unable to create notification record.');
  let delivered=0;
  const failures:string[]=[];
  for (const registered of tokens) {
    try {
      const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',...(process.env.EXPO_ACCESS_TOKEN?{Authorization:`Bearer ${process.env.EXPO_ACCESS_TOKEN}`}:{})},body:JSON.stringify({to:registered.token,title:input.title,body:input.body,sound:'default',data:{destination:input.destination,...input.data}})});
      const payload=(await response.json().catch(()=>null)) as {data?:ExpoTicket}|null;
      const ticket=payload?.data;
      if (!response.ok||!ticket||ticket.status==='error') {
        const code=ticket&&ticket.status==='error'?(ticket.details?.error??ticket.message):`HTTP_${response.status}`;
        if (code==='DeviceNotRegistered') await invalidatePushToken(input.userId,registered.id);
        await recordDelivery(notification.id,'PUSH','EXPO','FAILED',registered.deviceId,code);
        failures.push(code); continue;
      }
      await recordDelivery(notification.id,'PUSH','EXPO','SENT',registered.deviceId);
      delivered+=1;
    } catch (error) {
      const code=error instanceof Error?error.message:'EXPO_PROVIDER_ERROR';
      await recordDelivery(notification.id,'PUSH','EXPO','FAILED',registered.deviceId,code.slice(0,120)); failures.push(code);
    }
  }
  return {ok:delivered>0,delivered,failed:failures.length,failures};
}
