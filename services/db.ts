import { db } from '../lib/firebase';
import { Project, Session, Settings } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_PROJECTS } from '../constants';

// --- Projects ---

export const subscribeToProjects = (userId: string, callback: (projects: Project[]) => void) => {
  if (!db) return () => {};
  
  const collectionRef = db.collection(`users/${userId}/projects`);
  return collectionRef.onSnapshot((snapshot) => {
    const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
    // If no projects exist (new user), create defaults
    if (projects.length === 0) {
      initializeDefaultProjects(userId);
    } else {
      callback(projects);
    }
  });
};

const initializeDefaultProjects = async (userId: string) => {
  if (!db) return;
  const batchPromises = DEFAULT_PROJECTS.map(p => 
    db.collection(`users/${userId}/projects`).doc(p.id).set(p)
  );
  await Promise.all(batchPromises);
};

export const addProject = async (userId: string, project: Omit<Project, 'id'>) => {
  if (!db) return;
  await db.collection(`users/${userId}/projects`).add(project);
};

export const updateProject = async (userId: string, projectId: string, updates: Partial<Project>) => {
  if (!db) return;
  await db.collection(`users/${userId}/projects`).doc(projectId).update(updates);
};

export const deleteProject = async (userId: string, projectId: string) => {
  if (!db) return;
  await db.collection(`users/${userId}/projects`).doc(projectId).delete();
};

// --- Sessions ---

export const subscribeToSessions = (userId: string, callback: (sessions: Session[]) => void) => {
  if (!db) return () => {};
  
  // Order by endTime descending
  const q = db.collection(`users/${userId}/sessions`).orderBy('endTime', 'desc');
  
  return q.onSnapshot((snapshot) => {
    const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
    callback(sessions);
  });
};

export const addSession = async (userId: string, session: Session) => {
  if (!db) return;
  // We use set with the session.id since we generated it client-side
  await db.collection(`users/${userId}/sessions`).doc(session.id).set(session);
};

export const updateSessionInDb = async (userId: string, session: Session) => {
  if (!db) return;
  await db.collection(`users/${userId}/sessions`).doc(session.id).update({
    notes: session.notes,
    tags: session.tags
  });
};

// --- Settings ---

export const subscribeToSettings = (userId: string, callback: (settings: Settings) => void) => {
  if (!db) return () => {};
  
  return db.collection(`users/${userId}/settings`).doc('config').onSnapshot((docSnap) => {
    if (docSnap.exists) {
      callback(docSnap.data() as Settings);
    } else {
      // Initialize default settings
      db.collection(`users/${userId}/settings`).doc('config').set(DEFAULT_SETTINGS);
      callback(DEFAULT_SETTINGS);
    }
  });
};

export const updateSettingsInDb = async (userId: string, settings: Settings) => {
  if (!db) return;
  await db.collection(`users/${userId}/settings`).doc('config').set(settings);
};