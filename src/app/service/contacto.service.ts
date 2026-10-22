import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export interface Mail {
  id?: string;
  email: string;
  subject: string;
  name: string;
  message: string;
  source?: string;
  createdAt?: string;
}

/**
 * Servicio de mensajería y contacto web conectado directamente con Firestore ('contacto').
 */
@Injectable({
  providedIn: 'root',
})
export class ContactoService {
  private firebaseService = inject(FirebaseService);
  private readonly COLLECTION_NAME = 'contacto';

  /**
   * Envía / registra un nuevo mensaje en Firestore.
   */
  sendMail(message: Mail): Observable<any> {
    return from(this.addMessage(message));
  }

  private async addMessage(message: Mail): Promise<any> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const payload = {
      name: message.name,
      email: message.email,
      subject: message.subject,
      message: message.message,
      source: message.source || 'web',
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id, message: 'Mensaje enviado con éxito' };
  }

  /**
   * Escucha mensajes en tiempo real utilizando onSnapshot de Firestore.
   */
  listenMessages(): Observable<Mail[]> {
    return new Observable<Mail[]>((observer) => {
      const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
      const q = query(colRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const messages = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Mail, 'id'>),
          }));
          observer.next(messages);
        },
        (error) => {
          console.warn('Fallo query ordenada en listenMessages, usando fallback sin orden:', error);
          const unsubsFallback = onSnapshot(
            colRef,
            (snapFallback) => {
              const msgs = snapFallback.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<Mail, 'id'>),
              }));
              observer.next(msgs);
            },
            (err) => observer.error(err)
          );
          return () => unsubsFallback();
        }
      );

      return () => unsubscribe();
    });
  }

  /**
   * Obtiene todos los mensajes recibidos desde la web.
   */
  getMessages(): Observable<Mail[]> {
    return from(this.fetchMessages());
  }

  private async fetchMessages(): Promise<Mail[]> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    let snapshot;
    try {
      const q = query(colRef, orderBy('createdAt', 'desc'));
      snapshot = await getDocs(q);
    } catch {
      snapshot = await getDocs(colRef);
    }

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Mail, 'id'>),
    }));
  }

  /**
   * Elimina un mensaje por su ID.
   */
  deleteMessage(id: string): Observable<any> {
    return from(this.deleteMessageById(id));
  }

  private async deleteMessageById(id: string): Promise<any> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return { message: 'Mensaje eliminado con éxito' };
  }
}
