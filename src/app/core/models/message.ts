export type MessageType = 'text' | 'image' | 'file' | 'location';

/** Archivo adjunto guardado en el bucket privado chat-media de Supabase. */
export interface MessageFile {
  /** Ruta dentro del bucket: <roomId>/<uuid>-<nombre> */
  path: string;
  name: string;
  size: number;
  mime: string;
}

/** Ubicación compartida (grados decimales WGS84) y precisión aproximada en metros. */
export interface MessageLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface Message {
  id: string;
  roomId: string;
  authorId: string;
  type: MessageType;
  text: string;
  file: MessageFile | null;
  location: MessageLocation | null;
  createdAt: Date;
  editedAt: Date | null;
  deleted: boolean;
  /** true mientras el servidor de Firestore todavía no confirma la escritura */
  pending: boolean;
}
