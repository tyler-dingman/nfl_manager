import { NextResponse } from 'next/server';
import { MERCH_CATEGORIES, MERCH_PRODUCTS } from '@/features/merch/catalog';
export async function GET(){return NextResponse.json({categories:['New & Trending',...MERCH_CATEGORIES],products:MERCH_PRODUCTS});}
