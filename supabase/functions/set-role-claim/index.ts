import { cert, getApps, initializeApp } from 'npm:firebase-admin/app';
import { getAuth } from 'npm:firebase-admin/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

if (getApps().length === 0) {
  initializeApp({
    credential: cert(JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}')),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const idToken = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const decoded = await getAuth().verifyIdToken(idToken);

    const alreadySet = decoded['role'] === 'authenticated';
    if (!alreadySet) {
      await getAuth().setCustomUserClaims(decoded.uid, { role: 'authenticated' });
    }

    return Response.json({ ok: true, updated: !alreadySet }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 401, headers: corsHeaders });
  }
});