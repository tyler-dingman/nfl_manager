import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { sendPush } from '@/server/notifications/push';

export async function POST(request:NextRequest){
  if(process.env.NODE_ENV==='production')return NextResponse.json({error:'Not found.'},{status:404});
  try{
    assertSameOrigin(request);
    const user=await currentUser(request);if(!user)return authError('Unauthorized.',401);
    const result=await sendPush({userId:user.id,title:'Down & Distance',body:'Chiefs update: push notifications are working.',destination:'/three'});
    return NextResponse.json(result,{status:result.ok?200:409});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to send test notification.'},{status:500});}
}
