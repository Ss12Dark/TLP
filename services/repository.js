import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from '../firebase-init.js';

export class Repository {
  #collectionName;

  constructor(collectionName) {
    this.#collectionName = collectionName;
  }

  async getAll() {
    const snapshot = await getDocs(collection(db, this.#collectionName));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async getById(id) {
    const snap = await getDoc(doc(db, this.#collectionName, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async add(data) {
    const ref = await addDoc(collection(db, this.#collectionName), data);
    return ref.id;
  }

  async update(id, data) {
    await updateDoc(doc(db, this.#collectionName, id), data);
  }

  async remove(id) {
    await deleteDoc(doc(db, this.#collectionName, id));
  }

  async clone(id) {
    const item = await this.getById(id);
    if (!item) throw new Error('Not found');
    const { id: _existingId, ...data } = item;
    return this.add(data);
  }
}
