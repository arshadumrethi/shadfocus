import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, Pause, RotateCcw, Settings as SettingsIcon, 
  BarChart2, Timer as TimerIcon, Tag, Plus, CheckCircle, X, PlusCircle, Trash2,
  ChevronUp, ChevronDown, Clock, Watch, LogOut, User as UserIcon, MoreVertical, Edit
} from 'lucide-react';
import { Settings, Session, Project, ProjectColor, ActiveTimer } from './types';
import { PROJECT_COLORS, DEFAULT_PROJECTS } from './constants';
import { TimerDisplay } from './components/TimerDisplay';
import { Button } from './components/ui/Button';
import { Modal } from './components/ui/Modal';
import { SettingsForm } from './components/SettingsForm';
import { Dashboard } from './components/Dashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import * as db from './services/db';

// Sound utility (simple beep)
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

const AuthenticatedApp: React.FC = () => {
  const { user, logout } = useAuth();
  
  // --- State ---
  // Data State (now handled by Firestore subscriptions)
  const [settings, setSettings] = useState<Settings>({ timerDuration: 25, darkMode: false });
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  
  // UI Loading State
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Timer States - now synced from Firestore
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [displayTime, setDisplayTime] = useState({ timeLeft: 25 * 60, stopwatchSeconds: 0 }); // For smooth UI updates
  const [selectedMode, setSelectedMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro'); // Mode selection when no timer active
  
  const [view, setView] = useState<'timer' | 'dashboard'>('timer');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Session tracking state (for UI inputs, synced to activeTimer)
  const [currentNotes, setCurrentNotes] = useState('');
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Project Creation State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState<ProjectColor>('blue');

  // Project Edit State
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectColor, setEditProjectColor] = useState<ProjectColor>('blue');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Project Deletion State
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const displayUpdateRef = useRef<number | null>(null); // For UI update interval
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeProject = projects.length > 0 
    ? (projects.find(p => p.id === activeProjectId) || projects[0] || DEFAULT_PROJECTS[0])
    : DEFAULT_PROJECTS[0];
  const colorTheme = PROJECT_COLORS[activeProject?.color || 'blue'];
  
  // Computed timer values
  const timerMode = activeTimer?.mode || selectedMode;
  const isActive = activeTimer?.isActive || false;
  const timeLeft = displayTime?.timeLeft ?? ((settings?.timerDuration || 25) * 60);
  const stopwatchSeconds = displayTime?.stopwatchSeconds ?? 0;

  // --- Effects for Data Syncing ---

  useEffect(() => {
    if (!user) return;

    // Subscribe to Data
    const unsubscribeProjects = db.subscribeToProjects(user.uid, (data) => {
      setProjects(data);
      setIsLoadingData(false);
    });

    const unsubscribeSessions = db.subscribeToSessions(user.uid, (data) => {
      setSessions(data);
    });

    const unsubscribeSettings = db.subscribeToSettings(user.uid, (data) => {
      setSettings(data);
    });

    const unsubscribeActiveTimer = db.subscribeToActiveTimer(user.uid, (timer) => {
      try {
        setActiveTimer(timer);
        // Sync notes and tags from activeTimer to local state for UI
        if (timer) {
          setCurrentNotes(timer.notes || '');
          setCurrentTags(timer.tags || []);
        } else {
          // Timer stopped, clear inputs
          setCurrentNotes('');
          setCurrentTags([]);
        }
      } catch (error) {
        console.error('Error handling activeTimer update:', error);
      }
    });

    return () => {
      unsubscribeProjects();
      unsubscribeSessions();
      unsubscribeSettings();
      unsubscribeActiveTimer();
    };
  }, [user]);

  // Ensure active project exists
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
    };
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  // Sync notes and tags changes to Firestore when activeTimer exists
  useEffect(() => {
    if (user && activeTimer) {
      // Debounce updates to avoid too many writes
      const timeoutId = setTimeout(() => {
        if (currentNotes !== activeTimer.notes || JSON.stringify(currentTags) !== JSON.stringify(activeTimer.tags)) {
          db.updateTimerMetadata(user.uid, currentNotes, currentTags);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [currentNotes, currentTags, activeTimer, user]);

  // Timer Logic: Calculate time from activeTimer and update display
  useEffect(() => {
    if (!activeTimer) {
      // No active timer, set defaults
      const defaultDuration = (settings?.timerDuration || 25) * 60;
      setDisplayTime({ 
        timeLeft: defaultDuration, 
        stopwatchSeconds: 0 
      });
      document.title = 'ShadFocus';
      return;
    }

    const calculateTime = () => {
      try {
        const now = Date.now();
        let elapsedSeconds = 0;
        
        // startTime = original start time (never changes)
        // pausedDuration = total time that was actually paused (time between pause and resume)
        // When paused: pausedAt marks when the pause happened
        // elapsed = running time = total time - paused time
        
        if (!activeTimer.startTime) {
          // Invalid timer data, reset
          return;
        }
        
        const totalElapsed = (now - activeTimer.startTime) / 1000;
        const pausedDuration = activeTimer.pausedDuration || 0;
        
        if (activeTimer.isActive) {
          // Timer is running: elapsed = total time - paused time
          elapsedSeconds = totalElapsed - pausedDuration;
        } else {
          // Timer is paused: calculate elapsed at the moment of pause
          // The time since pausedAt is not counted (it's paused time)
          const pausedAt = activeTimer.pausedAt || now;
          const elapsedAtPause = (pausedAt - activeTimer.startTime) / 1000;
          elapsedSeconds = elapsedAtPause - pausedDuration;
        }
      
        if (activeTimer.mode === 'pomodoro') {
          const initialDuration = activeTimer.initialDuration || (settings?.timerDuration || 25) * 60;
          const remaining = Math.max(0, initialDuration - elapsedSeconds);
          setDisplayTime({ timeLeft: Math.floor(remaining), stopwatchSeconds: 0 });
          
          // Update document title
          if (activeTimer.isActive) {
            const minutes = Math.floor(remaining / 60);
            const seconds = Math.floor(remaining % 60);
            document.title = `ShadFocus - ${minutes}:${seconds.toString().padStart(2, '0')}`;
          } else {
            document.title = 'ShadFocus';
          }
        } else {
          // Stopwatch mode
          const elapsed = Math.floor(elapsedSeconds);
          setDisplayTime({ timeLeft: 0, stopwatchSeconds: elapsed });
          
          // Update document title
          if (activeTimer.isActive) {
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            document.title = `ShadFocus - ${minutes}:${seconds.toString().padStart(2, '0')}`;
          } else {
            document.title = 'ShadFocus';
          }
        }
      } catch (error) {
        console.error('Error calculating timer time:', error);
      }
    };

    // Calculate immediately
    calculateTime();

    // Update every second for smooth UI
    displayUpdateRef.current = window.setInterval(calculateTime, 1000);

    return () => {
      if (displayUpdateRef.current) {
        clearInterval(displayUpdateRef.current);
      }
    };
  }, [activeTimer, settings.timerDuration]);

  // --- Handlers ---

  const resetTimer = useCallback(() => {
    if (user) {
      db.stopTimer(user.uid);
    }
  }, [user]);

  const saveSession = useCallback((actualDurationSeconds?: number) => {
    if (!user || !activeTimer) return;

    let duration = 0;
    if (actualDurationSeconds !== undefined) {
      duration = actualDurationSeconds;
    } else {
      // Calculate from activeTimer
      const now = Date.now();
      const elapsedSeconds = (now - activeTimer.startTime) / 1000 - (activeTimer.pausedDuration || 0);
      if (activeTimer.mode === 'pomodoro') {
        const initialDuration = activeTimer.initialDuration || settings.timerDuration * 60;
        duration = Math.max(0, initialDuration - elapsedSeconds);
        // For pomodoro, we want the time that was actually used
        duration = (activeTimer.initialDuration || settings.timerDuration * 60) - duration;
      } else {
        duration = Math.floor(elapsedSeconds);
      }
    }

    // Use project from activeTimer
    const projectToSave = projects.find(p => p.id === activeTimer.projectId) || activeProject || (projects.length > 0 ? projects[0] : DEFAULT_PROJECTS[0]);

    const newSession: Session = {
      id: crypto.randomUUID(),
      projectId: activeTimer.projectId,
      projectName: activeTimer.projectName,
      startTime: activeTimer.startTime,
      endTime: Date.now(),
      durationSeconds: duration,
      notes: activeTimer.notes || currentNotes,
      tags: activeTimer.tags || currentTags,
      color: projectToSave.color,
    };

    // Save to Firestore
    db.addSession(user.uid, newSession);

    // Clear active timer
    db.stopTimer(user.uid);
  }, [activeTimer, activeProject, projects, settings.timerDuration, currentNotes, currentTags, user]);

  // Timer Logic: Completion Check for Pomodoro
  useEffect(() => {
    if (activeTimer && activeTimer.mode === 'pomodoro' && activeTimer.isActive && timeLeft === 0) {
      if (!user || !activeTimer) return;
      try {
        playNotificationSound();
        // Save session with full duration
        const initialDuration = activeTimer.initialDuration || (settings?.timerDuration || 25) * 60;
        saveSession(initialDuration);
      } catch (error) {
        console.error('Error completing timer:', error);
      }
    }
  }, [activeTimer, timeLeft, user, settings, saveSession]); // eslint-disable-line

  const handleFinishEarly = () => {
    if (!user || !activeTimer) return;
    
    // Calculate actual duration from activeTimer
    const now = Date.now();
    const elapsedSeconds = (now - activeTimer.startTime) / 1000 - (activeTimer.pausedDuration || 0);
    let duration = 0;
    
    if (activeTimer.mode === 'pomodoro') {
      const initialDuration = activeTimer.initialDuration || settings.timerDuration * 60;
      const remaining = Math.max(0, initialDuration - elapsedSeconds);
      duration = initialDuration - remaining;
    } else {
      duration = Math.floor(elapsedSeconds);
    }

    if (duration > 1) {
      saveSession(duration);
      playNotificationSound();
    } else {
      // If duration is too short, just stop the timer
      db.stopTimer(user.uid);
    }
  };

  const handleUpdateSession = (updatedSession: Session) => {
    if (user) {
      db.updateSessionInDb(user.uid, updatedSession);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    if (user) {
      db.deleteSession(user.uid, sessionId);
    }
  };

  const handleSaveSettings = (newSettings: Settings) => {
    if (user) {
      // Update settings immediately without closing modal or resetting timer
      db.updateSettingsInDb(user.uid, newSettings);
      setSettings(newSettings);
      // If timer is running and duration changed, update activeTimer
      if (activeTimer && activeTimer.mode === 'pomodoro' && activeTimer.isActive && newSettings.timerDuration !== settings.timerDuration) {
        // Update the initialDuration in activeTimer
        // Explicitly construct timerData to avoid undefined values
        const timerData: Omit<ActiveTimer, 'id'> = {
          mode: activeTimer.mode,
          isActive: activeTimer.isActive,
          startTime: activeTimer.startTime,
          pausedDuration: activeTimer.pausedDuration || 0,
          projectId: activeTimer.projectId,
          projectName: activeTimer.projectName,
          notes: activeTimer.notes || '',
          tags: activeTimer.tags || [],
          initialDuration: newSettings.timerDuration * 60,
        };
        if (activeTimer.pausedAt) {
          timerData.pausedAt = activeTimer.pausedAt;
        }
        db.startTimer(user.uid, timerData);
      }
      // Don't close modal - let user continue adjusting settings
    }
  };

  const toggleTimer = () => {
    if (!user) return;
    
    if (!activeTimer) {
      // Start new timer
      const projectToUse = activeProject || projects[0] || DEFAULT_PROJECTS[0];
      const initialDuration = settings.timerDuration * 60;
      
      const timerData: Omit<ActiveTimer, 'id'> = {
        mode: selectedMode,
        isActive: true,
        startTime: Date.now(),
        pausedDuration: 0,
        projectId: projectToUse.id,
        projectName: projectToUse.name,
        notes: currentNotes,
        tags: currentTags,
      };
      
      // Only add initialDuration for pomodoro mode
      if (selectedMode === 'pomodoro') {
        timerData.initialDuration = initialDuration;
      }
      
      db.startTimer(user.uid, timerData);
    } else if (activeTimer.isActive) {
      // Pause timer
      db.pauseTimer(user.uid);
    } else {
      // Resume timer
      db.resumeTimer(user.uid);
    }
  };

  const changeDuration = (change: number) => {
    const newDuration = Math.max(1, Math.min(180, settings.timerDuration + change));
    if (user) {
       // Optimistic update
       setSettings(prev => ({ ...prev, timerDuration: newDuration }));
       db.updateSettingsInDb(user.uid, { ...settings, timerDuration: newDuration });
       // If timer is active and pomodoro, update activeTimer
       if (activeTimer && activeTimer.mode === 'pomodoro' && activeTimer.isActive) {
         // Explicitly construct timerData to avoid undefined values
         const timerData: Omit<ActiveTimer, 'id'> = {
           mode: activeTimer.mode,
           isActive: activeTimer.isActive,
           startTime: activeTimer.startTime,
           pausedDuration: activeTimer.pausedDuration || 0,
           projectId: activeTimer.projectId,
           projectName: activeTimer.projectName,
           notes: activeTimer.notes || '',
           tags: activeTimer.tags || [],
           initialDuration: newDuration * 60,
         };
         if (activeTimer.pausedAt) {
           timerData.pausedAt = activeTimer.pausedAt;
         }
         db.startTimer(user.uid, timerData);
       }
    }
  };

  const addTag = () => {
    if (newTagInput.trim() && !currentTags.includes(newTagInput.trim())) {
      const updatedTags = [...currentTags, newTagInput.trim()];
      setCurrentTags(updatedTags);
      setNewTagInput('');
      // Sync to Firestore if timer is active
      if (user && activeTimer) {
        db.updateTimerMetadata(user.uid, currentNotes, updatedTags);
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    setCurrentTags(updatedTags);
    // Sync to Firestore if timer is active
    if (user && activeTimer) {
      db.updateTimerMetadata(user.uid, currentNotes, updatedTags);
    }
  };

  const createProject = () => {
    if (!newProjectName.trim() || !user) return;
    
    db.addProject(user.uid, {
      name: newProjectName,
      color: newProjectColor
    });
    
    // Optimistic switch handled by active ID after sync, but we can set it here if we generated ID
    // Simpler to just close modal and let listener update.
    setIsNewProjectModalOpen(false);
    setNewProjectName('');
    setNewProjectColor('blue');
  };

  const openEditProject = (project: Project) => {
    setProjectToEdit(project);
    setEditProjectName(project.name);
    setEditProjectColor(project.color);
    setOpenMenuId(null);
  };

  const updateProject = () => {
    if (!editProjectName.trim() || !projectToEdit || !user) return;
    
    db.updateProject(user.uid, projectToEdit.id, {
      name: editProjectName.trim(),
      color: editProjectColor
    });
    
    setProjectToEdit(null);
    setEditProjectName('');
    setEditProjectColor('blue');
  };

  const initiateDeleteProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (projects.length <= 1) {
      alert("You need at least one project.");
      return;
    }
    setProjectToDelete(project);
  };

  const confirmDeleteProject = () => {
    if (!projectToDelete || !user) return;

    // Logic to switch active project if we delete the current one
    if (activeProjectId === projectToDelete.id) {
       const other = projects.find(p => p.id !== projectToDelete.id);
       if (other) setActiveProjectId(other.id);
    }

    db.deleteProject(user.uid, projectToDelete.id);
    setProjectToDelete(null);
  };

  // Don't block rendering if data is still loading - show UI with defaults
  // if (isLoadingData) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gray-50">
  //       <div className="animate-pulse flex flex-col items-center">
  //         <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
  //         <div className="h-4 w-32 bg-gray-200 rounded"></div>
  //       </div>
  //     </div>
  //   );
  // }

  const isDarkMode = settings?.darkMode ?? false;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Navigation */}
      <nav className={`fixed top-0 w-full p-4 flex justify-center z-40 backdrop-blur-md border-b ${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-gray-100'}`}>
        <div className="w-full max-w-4xl flex justify-between items-center">
          <button
            onClick={() => setView('timer')}
            className={`text-xl font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              isDarkMode 
                ? 'text-gray-100 hover:text-gray-300' 
                : 'text-gray-800 hover:text-gray-600'
            }`}
            title="Go to Timer"
          >
             ShadFocus
          </button>
          <div className="flex gap-2 items-center">
            <button 
              onClick={() => setView('timer')}
              className={`p-2 rounded-lg transition-colors ${view === 'timer' 
                ? (isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900') 
                : (isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50')
              }`}
              title="Timer"
            >
              <TimerIcon size={24} />
            </button>
            <button 
              onClick={() => setView('dashboard')}
              className={`p-2 rounded-lg transition-colors ${view === 'dashboard' 
                ? (isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900') 
                : (isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50')
              }`}
              title="Dashboard"
            >
              <BarChart2 size={24} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}
              title="Settings"
            >
              <SettingsIcon size={24} />
            </button>
            
            {/* User Profile */}
            <div className={`ml-2 pl-2 border-l flex items-center gap-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full border border-gray-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserIcon size={16} />
                </div>
              )}
              <button onClick={logout} className={`p-2 transition-colors ${isDarkMode ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`} title="Sign Out">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 max-w-4xl mx-auto min-h-screen">
        {view === 'timer' ? (
          <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Top Section: New Project & Project List */}
            <div className="w-full max-w-4xl">
              <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button 
                    onClick={() => setIsNewProjectModalOpen(true)}
                    variant="primary"
                    className={`!rounded-lg px-6 py-3 ${
                      isDarkMode 
                        ? 'shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 bg-blue-500 hover:bg-blue-600' 
                        : 'shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40'
                    }`}
                    themeColorClass={isDarkMode ? 'bg-blue-500' : 'bg-gray-900'}
                  >
                    <PlusCircle size={18} /> New Project
                  </Button>
                  <Button 
                    onClick={() => setView('dashboard')}
                    variant="secondary"
                    className="!rounded-lg px-6 py-3 shadow-lg shadow-gray-300/50 hover:shadow-xl hover:shadow-gray-300/70 underline"
                  >
                    Go to Dashboard
                  </Button>
                </div>
                
                <div className="text-right hidden sm:block">
                  <span className={`text-xs uppercase tracking-wider block ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Currently Working On</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : PROJECT_COLORS[activeProject.color].text}`}>{activeProject.name}</span>
                </div>
              </div>

               {/* Projects List - Grid Layout */}
               <div className="grid grid-cols-3 gap-4 mb-6">
                {projects.map(p => {
                  const pTheme = PROJECT_COLORS[p.color];
                  const isActiveProject = activeProjectId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setActiveProjectId(p.id);
                        setOpenMenuId(null);
                      }}
                      className={`
                        group relative flex items-center justify-between gap-2 px-4 py-3 rounded-xl border transition-all cursor-pointer select-none w-full
                        ${isActiveProject 
                          ? `${pTheme.primary} text-white border-transparent shadow-md` 
                          : isDarkMode 
                            ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600' 
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActiveProject ? 'bg-white' : pTheme.primary}`}></div>
                        <span className="text-sm font-medium truncate">{p.name}</span>
                      </div>
                      
                      {/* 3-dot Menu */}
                      <div className="relative flex-shrink-0">
                        <button
                          ref={(el) => { menuButtonRefs.current[p.id] = el; }}
                          type="button"
                          data-project-id={p.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === p.id ? null : p.id);
                          }}
                          className={`
                            p-1.5 rounded-full transition-all z-30 flex items-center justify-center
                            ${isActiveProject 
                              ? 'text-white/70 hover:text-white hover:bg-black/20' 
                              : isDarkMode
                                ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700 opacity-0 group-hover:opacity-100'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100'
                            }
                          `}
                          title="Project Options"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
               </div>
               
               {/* Dropdown Menu - Rendered as portal outside overflow container */}
               {openMenuId && menuButtonRefs.current[openMenuId] && createPortal(
                 <div 
                   className={`fixed z-50 rounded-lg shadow-lg border py-1 min-w-[120px] ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                   style={{
                     top: `${menuButtonRefs.current[openMenuId]!.getBoundingClientRect().bottom + 4}px`,
                     left: `${menuButtonRefs.current[openMenuId]!.getBoundingClientRect().right - 120}px`
                   }}
                   onClick={(e) => e.stopPropagation()}
                 >
                   {(() => {
                     const project = projects.find(p => p.id === openMenuId);
                     if (!project) return null;
                     return (
                       <>
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             openEditProject(project);
                           }}
                           className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}
                         >
                           <Edit size={14} />
                           Edit
                         </button>
                         {projects.length > 1 && (
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               initiateDeleteProject(project, e);
                               setOpenMenuId(null);
                             }}
                             className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${isDarkMode ? 'text-red-400 hover:bg-red-900/30' : 'text-red-600 hover:bg-red-50'}`}
                           >
                             <Trash2 size={14} />
                             Delete
                           </button>
                         )}
                       </>
                     );
                   })()}
                 </div>,
                 document.body
               )}
            </div>

            {/* Mode Toggle */}
            <div className={`p-1.5 rounded-xl flex gap-1 mb-2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
              <button
                onClick={() => {
                  // Stop timer if active and switch mode
                  if (user && activeTimer) {
                    db.stopTimer(user.uid);
                  }
                  setSelectedMode('stopwatch');
                }}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${timerMode === 'stopwatch' 
                  ? (isDarkMode ? 'bg-gray-700 text-gray-100 shadow-sm' : 'bg-white text-gray-900 shadow-sm')
                  : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                }`}
              >
                <Watch size={16} /> Timer
              </button>
              <button
                onClick={() => {
                  // Stop timer if active and switch mode
                  if (user && activeTimer) {
                    db.stopTimer(user.uid);
                  }
                  setSelectedMode('pomodoro');
                }}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${timerMode === 'pomodoro' 
                  ? (isDarkMode ? 'bg-gray-700 text-gray-100 shadow-sm' : 'bg-white text-gray-900 shadow-sm')
                  : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                }`}
              >
                <Clock size={16} /> Pomodoro
              </button>
            </div>

            {/* Main Timer Area */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12 w-full">
              <div className="hidden md:block w-16"></div>
              <div className="relative z-0">
                <TimerDisplay 
                  seconds={timerMode === 'pomodoro' ? timeLeft : stopwatchSeconds}
                  totalTime={settings.timerDuration * 60} 
                  colorTheme={colorTheme}
                  isActive={isActive}
                  mode={timerMode}
                />
              </div>

              <div className="w-full md:w-16 flex flex-row md:flex-col items-center justify-center gap-4 md:gap-2">
                {timerMode === 'pomodoro' && (
                  <>
                     <span className={`text-xs font-bold uppercase tracking-widest md:hidden ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Duration</span>
                     <button 
                      onClick={() => !isActive && changeDuration(5)}
                      disabled={isActive}
                      className={`p-3 rounded-xl border shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                      title="Add 5 minutes"
                    >
                      <ChevronUp size={20} />
                    </button>
                    
                    <div className={`text-center px-3 py-2 rounded-xl border shadow-sm min-w-[4rem] ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700' 
                        : 'bg-white border-gray-200'
                    }`}>
                      <span className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>{settings.timerDuration}</span>
                      <span className={`text-xs block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>min</span>
                    </div>

                    <button 
                      onClick={() => !isActive && changeDuration(-5)}
                      disabled={isActive}
                      className={`p-3 rounded-xl border shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                      title="Subtract 5 minutes"
                    >
                      <ChevronDown size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6 z-10 w-full mt-2">
               <button 
                onClick={resetTimer}
                className={`p-4 rounded-full shadow-md transition-all active:scale-95 border ${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                    : 'bg-white border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
                title="Reset Timer"
              >
                <RotateCcw size={24} />
              </button>

              <button 
                onClick={toggleTimer}
                className={`
                  p-6 rounded-full text-white shadow-xl shadow-gray-200/50 
                  transform transition-all duration-200 active:scale-95 hover:scale-105
                  ${colorTheme.primary}
                `}
                title={isActive ? "Pause" : "Start"}
              >
                {isActive ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-1" />}
              </button>

              <button 
                onClick={handleFinishEarly}
                disabled={(!activeTimer?.startTime && timerMode === 'pomodoro') && stopwatchSeconds === 0}
                className={`
                  p-4 rounded-full shadow-md transition-all active:scale-95 border group relative ${
                    isDarkMode 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-white border-gray-100'
                  }
                  ${((activeTimer?.startTime || isActive) || stopwatchSeconds > 0) 
                    ? (isDarkMode ? 'text-green-400 hover:text-green-300 hover:bg-green-900/30' : 'text-green-600 hover:text-green-700 hover:bg-green-50')
                    : (isDarkMode ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed')
                  }
                `}
                title="Finish & Save Session"
              >
                <CheckCircle size={24} />
              </button>
            </div>

            {/* Session Details Input */}
            <div className={`w-full max-w-md p-6 rounded-3xl shadow-lg border mt-8 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-100'
            }`}>
              <div className={`flex items-center gap-2 mb-4 text-sm font-medium uppercase tracking-wide ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <Tag size={14} /> Session Notes
              </div>
              
              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="What are you working on?"
                    value={currentNotes}
                    onChange={(e) => setCurrentNotes(e.target.value)}
                    className={`w-full text-lg font-medium border-none focus:ring-0 p-0 bg-transparent focus:outline-none ${
                      isDarkMode 
                        ? 'text-gray-100 placeholder-gray-500' 
                        : 'text-gray-800 placeholder-gray-300'
                    }`}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2 min-h-[28px]">
                    {currentTags.length === 0 && (
                      <span className={`text-sm italic py-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No tags added yet</span>
                    )}
                    {currentTags.map(tag => (
                      <span key={tag} className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorTheme.secondary} ${colorTheme.accent} border border-transparent hover:border-current transition-all`}>
                        #{tag}
                        <button onClick={() => removeTag(tag)} className="ml-2 hover:text-red-500 rounded-full hover:bg-red-50 p-0.5">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 w-full">
                    <div className="relative flex-1">
                      <Tag size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Add a tag..."
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                        className={`w-full pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      />
                    </div>
                    <button 
                      onClick={addTag}
                      disabled={!newTagInput.trim()}
                      className="p-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <Dashboard 
            sessions={sessions} 
            updateSession={handleUpdateSession} 
            deleteSession={handleDeleteSession}
            darkMode={isDarkMode} 
          />
        )}
      </main>

      <Modal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        title="Settings"
        darkMode={isDarkMode}
      >
        <SettingsForm 
          settings={settings} 
          onSave={handleSaveSettings}
          onCancel={() => setIsSettingsOpen(false)}
          darkMode={isDarkMode}
        />
      </Modal>

      <Modal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        title="Create New Project"
        darkMode={isDarkMode}
      >
        <div className="space-y-6">
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Project Name</label>
            <input 
              type="text" 
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g., Client Work, Learning"
              className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                  : 'border-gray-300'
              }`}
              autoFocus
            />
          </div>
          
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Project Color</label>
            <div className="flex gap-3">
              {(Object.keys(PROJECT_COLORS) as ProjectColor[]).map((c) => (
                 <button
                  key={c}
                  onClick={() => setNewProjectColor(c)}
                  className={`
                    w-10 h-10 rounded-full transition-all flex items-center justify-center
                    ${PROJECT_COLORS[c].primary} 
                    ${newProjectColor === c ? `ring-4 ring-offset-2 ${isDarkMode ? 'ring-gray-600' : 'ring-gray-200'} scale-110` : 'hover:scale-105 opacity-80 hover:opacity-100'}
                  `}
                >
                  {newProjectColor === c && <CheckCircle size={16} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className={`flex justify-end gap-3 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
             <Button variant="secondary" onClick={() => setIsNewProjectModalOpen(false)}>Cancel</Button>
             <Button onClick={createProject} disabled={!newProjectName.trim()}>Create Project</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!projectToEdit}
        onClose={() => {
          setProjectToEdit(null);
          setEditProjectName('');
          setEditProjectColor('blue');
        }}
        title="Edit Project"
        darkMode={isDarkMode}
      >
        <div className="space-y-6">
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Project Name</label>
            <input 
              type="text" 
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              placeholder="e.g., Client Work, Learning"
              className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                  : 'border-gray-300'
              }`}
              autoFocus
            />
          </div>
          
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Project Color</label>
            <div className="flex gap-3">
              {(Object.keys(PROJECT_COLORS) as ProjectColor[]).map((c) => (
                 <button
                  key={c}
                  onClick={() => setEditProjectColor(c)}
                  className={`
                    w-10 h-10 rounded-full transition-all flex items-center justify-center
                    ${PROJECT_COLORS[c].primary} 
                    ${editProjectColor === c ? `ring-4 ring-offset-2 ${isDarkMode ? 'ring-gray-600' : 'ring-gray-200'} scale-110` : 'hover:scale-105 opacity-80 hover:opacity-100'}
                  `}
                >
                  {editProjectColor === c && <CheckCircle size={16} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className={`flex justify-end gap-3 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
             <Button variant="secondary" onClick={() => {
               setProjectToEdit(null);
               setEditProjectName('');
               setEditProjectColor('blue');
             }}>Cancel</Button>
             <Button onClick={updateProject} disabled={!editProjectName.trim()}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        title="Delete Project?"
        darkMode={isDarkMode}
      >
        <div className="space-y-4">
          <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
            Are you sure you want to delete <strong>{projectToDelete?.name}</strong>?
          </p>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            This will remove it from your active projects list. Your past sessions for this project will remain in your history.
          </p>
          <div className="flex justify-end gap-3 pt-4">
             <Button variant="secondary" onClick={() => setProjectToDelete(null)}>No, Keep It</Button>
             <Button variant="danger" onClick={confirmDeleteProject}>Yes, Delete</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
};

// Wrapper to handle login state
const Main: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return <AuthenticatedApp />;
};

export default App;