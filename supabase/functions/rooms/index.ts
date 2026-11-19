import { createClient } from 'npm:@supabase/supabase-js@2';
import { cert, getApps, initializeApp } from 'npm:firebase-admin/app';
import { getAuth } from 'npm:firebase-admin/auth';
import { FieldValue, initializeFirestore } from 'npm:firebase-admin/firestore';


// ---------- Configuración (se ejecuta una vez por instancia) ----------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const firebaseApp =
  getApps()[0] ??
  initializeApp({ credential: cert(JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}')) });

const firestore = initializeFirestore(firebaseApp, { preferRest: true });

const secretKey: string =
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default ??
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  '';
const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', secretKey, {
  auth: { persistSession: false },
});

// ---------- Tipos ----------
class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type RequestBody =
  | { action: 'create'; name: string; description?: string; isPrivate?: boolean }
  | { action: 'join'; roomId: string }
  | { action: 'leave'; roomId: string }
  | { action: 'add'; roomId: string; userId: string }
  | { action: 'direct'; otherUserId: string };

// ---------- Punto de entrada ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers':
          req.headers.get('Access-Control-Request-Headers') ?? corsHeaders['Access-Control-Allow-Headers'],
      },
    });
  }

  try {
    const uid = await verifyUser(req);
    const body = (await req.json()) as RequestBody;

    let result: Record<string, unknown>;
    switch (body.action) {
      case 'create':
        result = await createRoom(uid, body.name, body.description ?? '', body.isPrivate ?? false);
        break;
      case 'join':
        result = await joinRoom(uid, body.roomId);
        break;
      case 'leave':
        result = await leaveRoom(uid, body.roomId);
        break;
      case 'add':
        result = await addMember(uid, body.roomId, body.userId);
        break;
      case 'direct':
        result = await openDirect(uid, body.otherUserId);
        break;
      default:
        throw new HttpError(400, 'Acción desconocida');
    }
    return json(200, { ok: true, ...result });
  } catch (error) {
    console.error(error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = (error as { message?: string })?.message ?? String(error);
    return json(status, { ok: false, error: message });
  }
});

// ---------- Acciones ----------
async function createRoom(uid: string, name: string, description: string, isPrivate: boolean) {
  const cleanName = (name ?? '').trim();
  if (cleanName.length < 1 || cleanName.length > 50) {
    throw new HttpError(400, 'El nombre debe tener entre 1 y 50 caracteres');
  }

  const { data: room, error } = await db
    .from('rooms')
    .insert({
      type: 'group',
      name: cleanName,
      description: description.trim().slice(0, 200),
      is_private: isPrivate,
      created_by: uid,
    })
    .select('id')
    .single();
  if (error) throw error;

  await addMembership(room.id, uid, 'owner');
  return { roomId: room.id };
}

async function joinRoom(uid: string, roomId: string) {
  const room = await getRoom(roomId);
  if (room.type !== 'group' || room.is_private) {
    throw new HttpError(403, 'Solo puedes unirte a salas públicas');
  }
  await addMembership(roomId, uid, 'member');
  return { roomId };
}

async function leaveRoom(uid: string, roomId: string) {
  const room = await getRoom(roomId);
  if (room.type !== 'group') throw new HttpError(400, 'No puedes salir de un chat directo');
  await removeMembership(roomId, uid);
  return { roomId };
}

async function addMember(uid: string, roomId: string, userId: string) {
  const room = await getRoom(roomId);
  if (room.type !== 'group') throw new HttpError(400, 'Solo se agregan miembros a grupos');

  const { data: me } = await db
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', uid)
    .maybeSingle();
  if (me?.role !== 'owner') throw new HttpError(403, 'Solo el dueño puede agregar miembros');

  const { data: target } = await db.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!target) throw new HttpError(404, 'Ese usuario no existe');

  await addMembership(roomId, userId, 'member');
  return { roomId, userId };
}

async function openDirect(uid: string, otherUserId: string) {
  if (!otherUserId || otherUserId === uid) {
    throw new HttpError(400, 'Elige a otra persona');
  }

  const { data: other } = await db.from('profiles').select('id').eq('id', otherUserId).maybeSingle();
  if (!other) throw new HttpError(404, 'Ese usuario no existe');

  const dmKey = [uid, otherUserId].sort().join('_');

  let roomId = await findDirect(dmKey);
  const created = roomId === null;

  if (!roomId) {
    const { data, error } = await db
      .from('rooms')
      .insert({ type: 'direct', name: null, is_private: true, dm_key: dmKey, created_by: uid })
      .select('id')
      .single();

    if (error && error.code !== '23505') throw error;
    roomId = data?.id ?? (await findDirect(dmKey));
    if (!roomId) throw new Error('No se pudo crear el chat directo');
  }

  await addMembership(roomId, uid, 'member');
  await addMembership(roomId, otherUserId, 'member');
  return { roomId, created };
}

async function findDirect(dmKey: string): Promise<string | null> {
  const { data, error } = await db.from('rooms').select('id').eq('dm_key', dmKey).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// ---------- Auxiliares ----------
async function verifyUser(req: Request): Promise<string> {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new HttpError(401, 'Token inválido');
  }
}

async function getRoom(roomId: string) {
  const { data, error } = await db
    .from('rooms')
    .select('id, type, is_private')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'La sala no existe');
  return data;
}

async function addMembership(roomId: string, userId: string, role: 'owner' | 'member') {
  const { error } = await db
    .from('room_members')
    .upsert({ room_id: roomId, user_id: userId, role }, { onConflict: 'room_id,user_id', ignoreDuplicates: true });
  if (error) throw error;

  await firestore.doc(`rooms/${roomId}`).set({ members: FieldValue.arrayUnion(userId) }, { merge: true });
}

async function removeMembership(roomId: string, userId: string) {
  const { error } = await db.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
  if (error) throw error;

  await firestore.doc(`rooms/${roomId}`).set({ members: FieldValue.arrayRemove(userId) }, { merge: true });
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: corsHeaders });
}