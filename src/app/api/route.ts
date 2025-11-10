import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    name: 'ABZ Panel API',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
  });
}
