declare module 'firebase/app' {
  export const initializeApp: any;
  export const getApps: any;
  export const getApp: any;
}

declare module 'firebase/auth' {
  export const getAuth: any;
  export const signInWithEmailAndPassword: any;
  export const signOut: any;
  export const onAuthStateChanged: any;
  export type User = any;
}

declare module 'firebase/firestore' {
  export const getFirestore: any;
  export const collection: any;
  export const onSnapshot: any;
  export const addDoc: any;
  export const updateDoc: any;
  export const deleteDoc: any;
  export const doc: any;
  export const getDocs: any;
  export const getDoc: any;
  export const query: any;
  export const orderBy: any;
  export type QuerySnapshot = any;
  export type DocumentData = any;
}