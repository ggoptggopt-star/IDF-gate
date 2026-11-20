import { NextResponse } from 'next/server';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BBNcMz6a1mBTetLVv97ozWMRvsf9v4pFEAQkAyQwCYUMUzxfHxdxF_PrnHi03QlyoI1h_SM20XcRVV0D6mA0ft4';

export async function GET() {
  return NextResponse.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY,
  });
}
