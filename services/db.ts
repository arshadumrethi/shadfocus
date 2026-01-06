import { db } from '../lib/firebase';
import { Project, Session, Settings, ActiveTimer } from '../types';
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
    tags: session.tags,
    durationSeconds: session.durationSeconds,
    startTime: session.startTime,
    endTime: session.endTime,
    projectId: session.projectId,
    projectName: session.projectName,
    color: session.color
  });
};

export const deleteSession = async (userId: string, sessionId: string) => {
  if (!db) return;
  await db.collection(`users/${userId}/sessions`).doc(sessionId).delete();
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

// --- Active Timer ---

export const subscribeToActiveTimer = (userId: string, callback: (timer: ActiveTimer | null) => void) => {
  if (!db) return () => {};
  
  return db.collection('users').doc(userId).collection('activeTimers').doc('current').onSnapshot(
    (docSnap) => {
      try {
        if (docSnap.exists) {
          callback({ id: docSnap.id, ...docSnap.data() } as ActiveTimer);
        } else {
          callback(null);
        }
      } catch (error) {
        console.error('Error in activeTimer subscription:', error);
        callback(null);
      }
    },
    (error) => {
      console.error('Error subscribing to activeTimer:', error);
      callback(null);
    }
  );
};

export const startTimer = async (userId: string, timerData: Omit<ActiveTimer, 'id'>) => {
  if (!db) return;
  
  // Build the document, explicitly excluding undefined values
  const timerDoc: any = {
    mode: timerData.mode,
    isActive: timerData.isActive,
    startTime: Date.now(), // Original start time, never changes
    pausedDuration: timerData.pausedDuration ?? 0, // Total paused time in seconds
    projectId: timerData.projectId,
    projectName: timerData.projectName,
    notes: timerData.notes || '',
    tags: timerData.tags || [],
  };
  
  // Only include initialDuration if it's defined (for pomodoro mode)
  if (timerData.initialDuration !== undefined && timerData.initialDuration !== null) {
    timerDoc.initialDuration = timerData.initialDuration;
  }
  
  // Include pausedAt if it exists
  if (timerData.pausedAt !== undefined && timerData.pausedAt !== null) {
    timerDoc.pausedAt = timerData.pausedAt;
  }
  
  await db.collection('users').doc(userId).collection('activeTimers').doc('current').set(timerDoc);
};

export const pauseTimer = async (userId: string) => {
  if (!db) return;
  const timerDoc = await db.collection('users').doc(userId).collection('activeTimers').doc('current').get();
  if (!timerDoc.exists || !timerDoc.data()?.isActive) return;
  
  const timer = timerDoc.data() as ActiveTimer;
  const now = Date.now();
  const currentPausedDuration = timer.pausedDuration || 0;
  
  // Calculate running time since startTime (excluding already-paused time)
  // This is the time that was actively running
  const totalElapsed = (now - timer.startTime) / 1000;
  const runningTime = totalElapsed - currentPausedDuration;
  
  // When pausing, we don't add running time to pausedDuration
  // Instead, we just mark it as paused. The running time stays "running"
  // When we calculate elapsed later, we'll use pausedAt to know when it stopped
  await db.collection('users').doc(userId).collection('activeTimers').doc('current').update({
    isActive: false,
    pausedAt: now,
    // Keep pausedDuration as is - it only tracks time that was actually paused
  });
};

export const resumeTimer = async (userId: string) => {
  if (!db) return;
  const timerDoc = await db.collection('users').doc(userId).collection('activeTimers').doc('current').get();
  if (!timerDoc.exists) return;
  
  const timer = timerDoc.data() as ActiveTimer;
  const now = Date.now();
  const currentPausedDuration = timer.pausedDuration || 0;
  
  // Add the time that was paused (from pausedAt to now) to pausedDuration
  if (timer.pausedAt) {
    const pauseDuration = (now - timer.pausedAt) / 1000; // Convert to seconds
    const newPausedDuration = currentPausedDuration + pauseDuration;
    
    await db.collection('users').doc(userId).collection('activeTimers').doc('current').update({
      isActive: true,
      pausedAt: undefined,
      pausedDuration: newPausedDuration
    });
  } else {
    // No pausedAt, just resume
    await db.collection('users').doc(userId).collection('activeTimers').doc('current').update({
      isActive: true,
      pausedAt: undefined
    });
  }
};

export const stopTimer = async (userId: string) => {
  if (!db) return;
  await db.collection('users').doc(userId).collection('activeTimers').doc('current').delete();
};

export const updateTimerMetadata = async (userId: string, notes: string, tags: string[]) => {
  if (!db) return;
  await db.collection('users').doc(userId).collection('activeTimers').doc('current').update({
    notes,
    tags
  });
};