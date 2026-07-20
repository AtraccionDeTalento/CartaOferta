import { 
  signInWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

export type UserRole = 'Business Partner' | 'Compensaciones' | 'Nómina' | 'Admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatar?: string;
}

// Default mock profiles for multi-user workflow demonstration
export const MOCK_PROFILES: UserProfile[] = [
  {
    uid: "bp_1",
    email: "bp@usil.edu.pe",
    displayName: "Usuario (Business Partner)",
    role: "Business Partner",
    avatar: "👤"
  },
  {
    uid: "debora_1",
    email: "debora@usil.edu.pe",
    displayName: "Débora (Compensaciones)",
    role: "Compensaciones",
    avatar: "👩‍💼"
  },
  {
    uid: "nomina_1",
    email: "nomina@usil.edu.pe",
    displayName: "Nómina Operaciones",
    role: "Nómina",
    avatar: "📊"
  },
  {
    uid: "admin_1",
    email: "admin@usil.edu.pe",
    displayName: "Administrador de Sistemas",
    role: "Admin",
    avatar: "⚙️"
  }
];

// Password demo temporal — TODOS los roles usan la misma clave para la presentación.
// Recordar reemplazar por credenciales reales antes de un uso productivo.
export const TEMP_DEMO_PASSWORD = 'ADMIN';

export const verifyRolePassword = (_profile: UserProfile, password: string): boolean => {
  return password === TEMP_DEMO_PASSWORD;
};

const ROLE_AVATARS: Record<UserRole, string> = {
  'Business Partner': '👤',
  'Compensaciones': '👩‍💼',
  'Nómina': '📊',
  'Admin': '⚙️',
};

const REGISTERED_USERS_KEY = 'registered_users';

// Usuarios creados desde "Registrarse" — persisten en este navegador (demo local, sin backend de cuentas).
export const getRegisteredUsers = (): UserProfile[] => {
  try {
    const stored = localStorage.getItem(REGISTERED_USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const getAllProfiles = (): UserProfile[] => {
  return [...MOCK_PROFILES, ...getRegisteredUsers()];
};

export const registerNewUser = (input: { displayName: string; email: string; role: UserRole }): UserProfile => {
  const profile: UserProfile = {
    uid: `user_${Date.now()}`,
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    role: input.role,
    avatar: ROLE_AVATARS[input.role],
  };
  const list = getRegisteredUsers();
  list.push(profile);
  localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(list));
  return profile;
};

let currentUser: UserProfile | null = null;
const listeners = new Set<(user: UserProfile | null) => void>();

const notifyListeners = () => {
  listeners.forEach((l) => l(currentUser));
};

// Initialize Current User (defaults to Admin for presentation and instant admin access)
const initAuth = () => {
  const stored = localStorage.getItem('current_user');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
    } catch {
      currentUser = MOCK_PROFILES[3]; // Fallback to Admin profile
    }
  } else {
    currentUser = MOCK_PROFILES[3]; // Default to Admin profile
    localStorage.setItem('current_user', JSON.stringify(currentUser));
  }
  notifyListeners();
};

// Start listener
if (!isFirebaseConfigured) {
  setTimeout(initAuth, 100);
} else if (auth) {
  onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
    if (fbUser) {
      // In real production, role would come from custom claims or firestore user profiles.
      // We read a stored role or default based on email for simplicity.
      let role: UserRole = 'Business Partner';
      if (fbUser.email?.includes('debora')) role = 'Compensaciones';
      else if (fbUser.email?.includes('nomina')) role = 'Nómina';
      else if (fbUser.email?.includes('admin')) role = 'Admin';
      
      currentUser = {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || fbUser.email?.split('@')[0].toUpperCase() || 'Usuario',
        role
      };
    } else {
      initAuth();
      return;
    }
    notifyListeners();
  });
}

export const subscribeToAuth = (callback: (user: UserProfile | null) => void): (() => void) => {
  listeners.add(callback);
  callback(currentUser);
  return () => {
    listeners.delete(callback);
  };
};

export const getCurrentUser = (): UserProfile | null => {
  return currentUser;
};

// Login Mock
export const loginAsMockUser = (profile: UserProfile) => {
  currentUser = profile;
  localStorage.setItem('current_user', JSON.stringify(profile));
  notifyListeners();
};

export const signOutUser = async (): Promise<void> => {
  currentUser = null;
  localStorage.removeItem('current_user');
  if (isFirebaseConfigured && auth) {
    await fbSignOut(auth);
  }
  notifyListeners();
};
