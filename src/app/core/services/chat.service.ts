import { Injectable, inject } from '@angular/core';
import {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
  Unsubscribe,
  addDoc,
  collection,
  doc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Message, MessageFile, MessageLocation, MessageType } from '../models/message';
import { resizeImageToMax } from '../utils/image';
import { MAX_FILE_BYTES } from '../utils/files';
import { MediaService } from './media.service';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';

export const MAX_TEXT_LENGTH = 2000;

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly db = inject(FirebaseService).db;
  private readonly authService = inject(AuthService);
  private readonly media = inject(MediaService);

  /** Escucha los últimos `max` mensajes de una sala. Devuelve la función para dejar de escuchar. */
  listen(
    roomId: string,
    onMessages: (messages: Message[]) => void,
    onError: (error: Error) => void,
    max = 100,
  ): Unsubscribe {
    const q = query(this.messagesRef(roomId), orderBy('createdAt'), limitToLast(max));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => onMessages(snapshot.docs.map((d) => this.toMessage(roomId, d))),
      onError,
    );
  }

  async sendText(roomId: string, text: string): Promise<void> {
    const clean = this.validText(text);
    await addDoc(this.messagesRef(roomId), {
      authorId: this.requireUid(),
      type: 'text' satisfies MessageType,
      text: clean,
      createdAt: serverTimestamp(),
      editedAt: null,
      deleted: false,
    });
  }

  async editText(roomId: string, messageId: string, text: string): Promise<void> {
    await updateDoc(doc(this.messagesRef(roomId), messageId), {
      text: this.validText(text),
      editedAt: serverTimestamp(),
    });
  }

  /** Sube una imagen o un archivo a Supabase Storage y publica el mensaje en Firestore. */
  async sendMedia(roomId: string, kind: 'image' | 'file', original: File): Promise<void> {
    const authorId = this.requireUid();

    let data: Blob = original;
    let name = original.name;
    let mime = original.type || 'application/octet-stream';
    if (kind === 'image') {
      if (!mime.startsWith('image/')) throw new Error('Elige un archivo de imagen.');
      data = await resizeImageToMax(original);
      mime = data.type;
      name = name.replace(/\.[^.]+$/, '') + (mime === 'image/webp' ? '.webp' : '.png');
    }
    if (data.size > MAX_FILE_BYTES) throw new Error('El archivo supera el límite de 10 MB.');

    const path = await this.media.upload(roomId, data, name, mime);
    const file: MessageFile = { path, name, size: data.size, mime };

    try {
      await addDoc(this.messagesRef(roomId), {
        authorId,
        type: kind satisfies MessageType,
        text: '',
        file,
        createdAt: serverTimestamp(),
        editedAt: null,
        deleted: false,
      });
    } catch (e) {
      await this.media.remove(path).catch(() => undefined);
      throw e;
    }
  }

  async sendLocation(roomId: string, location: MessageLocation): Promise<void> {
    await addDoc(this.messagesRef(roomId), {
      authorId: this.requireUid(),
      type: 'location' satisfies MessageType,
      text: '',
      location: { lat: location.lat, lng: location.lng, accuracy: location.accuracy },
      createdAt: serverTimestamp(),
      editedAt: null,
      deleted: false,
    });
  }

  async deleteMessage(message: Message): Promise<void> {
    await updateDoc(doc(this.messagesRef(message.roomId), message.id), {
      text: '',
      deleted: true,
      editedAt: serverTimestamp(),
    });
    if (message.file) {
      await this.media.remove(message.file.path).catch(() => undefined);
    }
  }

  // ---------- Auxiliares ----------
  private messagesRef(roomId: string): CollectionReference<DocumentData> {
    return collection(this.db, 'rooms', roomId, 'messages');
  }

  private toMessage(roomId: string, snapshot: QueryDocumentSnapshot<DocumentData>): Message {
    const data = snapshot.data({ serverTimestamps: 'estimate' });
    return {
      id: snapshot.id,
      roomId,
      authorId: data['authorId'],
      type: data['type'],
      text: data['text'] ?? '',
      file: (data['file'] as MessageFile | undefined) ?? null,
      location: (data['location'] as MessageLocation | undefined) ?? null,
      createdAt: (data['createdAt'] as Timestamp | null)?.toDate() ?? new Date(),
      editedAt: (data['editedAt'] as Timestamp | null)?.toDate() ?? null,
      deleted: data['deleted'] === true,
      pending: snapshot.metadata.hasPendingWrites,
    };
  }

  private validText(text: string): string {
    const clean = text.trim();
    if (!clean) throw new Error('El mensaje está vacío');
    if (clean.length > MAX_TEXT_LENGTH) throw new Error(`Máximo ${MAX_TEXT_LENGTH} caracteres`);
    return clean;
  }

  private requireUid(): string {
    const uid = this.authService.user()?.uid;
    if (!uid) throw new Error('No hay sesión iniciada');
    return uid;
  }
}
