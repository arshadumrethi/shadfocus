import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, RotateCcw, Settings as SettingsIcon, 
  BarChart2, Timer as TimerIcon, Tag, Plus, CheckCircle, X, PlusCircle, Trash2,
  ChevronUp, ChevronDown, Clock, Watch, LogOut, User as UserIcon
} from 'lucide-react';
import { Settings, Session, Project, ProjectColor } from './types';
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
  const [settings, setSettings] = useState<Settings>({ timerDuration: 25 });
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  
  // UI Loading State
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Timer States
  const [timerMode, setTimerMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(25 * 60); 
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0); 
  
  const [isActive, setIsActive] = useState(false);
  const [view, setView] = useState<'timer' | 'dashboard'>('timer');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Session tracking state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentNotes, setCurrentNotes] = useState('');
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Project Creation State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState<ProjectColor>('blue');

  // Project Deletion State
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const timerRef = useRef<number | null>(null);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || DEFAULT_PROJECTS[0];
  const colorTheme = PROJECT_COLORS[activeProject?.color || 'blue'];

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
      // Only update time left if timer is NOT running and matches old duration
      if (!isActive && timerMode === 'pomodoro') {
        setTimeLeft(data.timerDuration * 60);
      }
    });

    return () => {
      unsubscribeProjects();
      unsubscribeSessions();
      unsubscribeSettings();
    };
  }, [user]);

  // Ensure active project exists
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

  // Timer Logic: Ticking
  useEffect(() => {
    if (isActive) {
      timerRef.current = window.setInterval(() => {
        if (timerMode === 'pomodoro') {
          setTimeLeft((prev) => {
            if (prev <= 0) return 0;
            return prev - 1;
          });
        } else {
          setStopwatchSeconds((prev) => prev + 1);
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timerMode]);

  // Timer Logic: Completion Check
  useEffect(() => {
    if (timerMode === 'pomodoro' && timeLeft === 0 && isActive) {
      handleTimerComplete();
    }
  }, [timeLeft, isActive, timerMode]); // eslint-disable-line

  // --- Handlers ---

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setStartTime(null);
    if (timerMode === 'pomodoro') {
      setTimeLeft(settings.timerDuration * 60);
    } else {
      setStopwatchSeconds(0);
    }
  }, [settings.timerDuration, timerMode]);

  const saveSession = useCallback((actualDurationSeconds?: number) => {
    if (!user) return;

    let duration = 0;
    if (actualDurationSeconds !== undefined) {
      duration = actualDurationSeconds;
    } else {
       duration = settings.timerDuration * 60;
    }

    // Use current active project safely
    const projectToSave = activeProject || projects[0];

    const newSession: Session = {
      id: crypto.randomUUID(),
      projectId: projectToSave.id,
      projectName: projectToSave.name,
      startTime: startTime || Date.now() - (duration * 1000),
      endTime: Date.now(),
      durationSeconds: duration,
      notes: currentNotes,
      tags: currentTags,
      color: projectToSave.color,
    };

    // Save to Firestore
    db.addSession(user.uid, newSession);

    // Reset session input fields
    setStartTime(null);
    setCurrentNotes('');
    setCurrentTags([]);
    resetTimer();
  }, [activeProject, projects, settings.timerDuration, startTime, currentNotes, currentTags, resetTimer, user]);

  const handleTimerComplete = useCallback(() => {
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    playNotificationSound();
    saveSession();
  }, [saveSession]);

  const handleFinishEarly = () => {
    const duration = timerMode === 'pomodoro' 
      ? (settings.timerDuration * 60) - timeLeft
      : stopwatchSeconds;

    if (duration > 1) {
      saveSession(duration);
      playNotificationSound();
    }
    
    setIsActive(false);
    resetTimer();
  };

  const handleUpdateSession = (updatedSession: Session) => {
    if (user) {
      db.updateSessionInDb(user.uid, updatedSession);
    }
  };

  const handleSaveSettings = (newSettings: Settings) => {
    if (user) {
      db.updateSettingsInDb(user.uid, newSettings);
      setSettings(newSettings);
      setIsSettingsOpen(false);
    }
  };

  const toggleTimer = () => {
    if (!isActive) {
      setIsActive(true);
      if (!startTime) setStartTime(Date.now());
    } else {
      setIsActive(false);
    }
  };

  const changeDuration = (change: number) => {
    const newDuration = Math.max(1, Math.min(180, settings.timerDuration + change));
    if (user) {
       // Optimistic update
       setSettings(prev => ({ ...prev, timerDuration: newDuration }));
       db.updateSettingsInDb(user.uid, { ...settings, timerDuration: newDuration });
       if (!isActive) setTimeLeft(newDuration * 60);
    }
  };

  const addTag = () => {
    if (newTagInput.trim() && !currentTags.includes(newTagInput.trim())) {
      setCurrentTags([...currentTags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setCurrentTags(currentTags.filter(t => t !== tagToRemove));
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

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 bg-gray-50`}>
      {/* Navigation */}
      <nav className="fixed top-0 w-full p-4 flex justify-center z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="w-full max-w-4xl flex justify-between items-center">
          <h1 className={`text-xl font-bold flex items-center gap-2 text-gray-800`}>
             ShadFocus
          </h1>
          <div className="flex gap-2 items-center">
            <button 
              onClick={() => setView('timer')}
              className={`p-2 rounded-lg transition-colors ${view === 'timer' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
              title="Timer"
            >
              <TimerIcon size={24} />
            </button>
            <button 
              onClick={() => setView('dashboard')}
              className={`p-2 rounded-lg transition-colors ${view === 'dashboard' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
              title="Dashboard"
            >
              <BarChart2 size={24} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
              title="Settings"
            >
              <SettingsIcon size={24} />
            </button>
            
            {/* User Profile */}
            <div className="ml-2 pl-2 border-l border-gray-200 flex items-center gap-2">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full border border-gray-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserIcon size={16} />
                </div>
              )}
              <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Sign Out">
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
            <div className="w-full max-w-xl">
              <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button 
                    onClick={() => setIsNewProjectModalOpen(true)}
                    variant="primary"
                    className="shadow-sm"
                    themeColorClass="bg-gray-900"
                  >
                    <PlusCircle size={18} /> New Project
                  </Button>
                  <Button 
                    onClick={() => setView('dashboard')}
                    variant="secondary"
                    className="shadow-sm"
                  >
                    Go to Dashboard
                  </Button>
                </div>
                
                <div className="text-right hidden sm:block">
                  <span className="text-xs text-gray-400 uppercase tracking-wider block">Currently Working On</span>
                  <span className={`font-semibold ${PROJECT_COLORS[activeProject.color].text}`}>{activeProject.name}</span>
                </div>
              </div>

               {/* Projects List */}
               <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x mb-6">
                {projects.map(p => {
                  const pTheme = PROJECT_COLORS[p.color];
                  const isActiveProject = activeProjectId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setActiveProjectId(p.id)}
                      className={`
                        group relative flex items-center gap-2 px-4 py-3 rounded-xl border transition-all whitespace-nowrap snap-start cursor-pointer select-none
                        ${isActiveProject 
                          ? `${pTheme.primary} text-white border-transparent shadow-md pr-10` 
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }
                      `}
                    >
                      <div className={`w-2 h-2 rounded-full ${isActiveProject ? 'bg-white' : pTheme.primary}`}></div>
                      <span className="text-sm font-medium">{p.name}</span>
                      
                      {/* Delete Button */}
                      {projects.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => initiateDeleteProject(p, e)}
                          className={`
                            absolute right-2 p-1.5 rounded-full transition-all z-20 flex items-center justify-center
                            ${isActiveProject 
                              ? 'text-white/70 hover:text-white hover:bg-black/20' 
                              : 'text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                            }
                          `}
                          title="Delete Project"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="bg-gray-200 p-1.5 rounded-xl flex gap-1 mb-2">
              <button
                onClick={() => {
                  setTimerMode('stopwatch');
                  setIsActive(false);
                  setStopwatchSeconds(0);
                  setStartTime(null);
                }}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${timerMode === 'stopwatch' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Watch size={16} /> Timer
              </button>
              <button
                onClick={() => {
                  setTimerMode('pomodoro');
                  setIsActive(false);
                  setTimeLeft(settings.timerDuration * 60);
                  setStartTime(null);
                }}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${timerMode === 'pomodoro' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
                     <span className="text-xs font-bold text-gray-400 uppercase tracking-widest md:hidden">Duration</span>
                     <button 
                      onClick={() => !isActive && changeDuration(5)}
                      disabled={isActive}
                      className="p-3 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95"
                      title="Add 5 minutes"
                    >
                      <ChevronUp size={20} />
                    </button>
                    
                    <div className="text-center bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm min-w-[4rem]">
                      <span className="text-xl font-bold text-gray-800">{settings.timerDuration}</span>
                      <span className="text-xs text-gray-500 block">min</span>
                    </div>

                    <button 
                      onClick={() => !isActive && changeDuration(-5)}
                      disabled={isActive}
                      className="p-3 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95"
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
                className="p-4 rounded-full bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 shadow-md transition-all active:scale-95 border border-gray-100"
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
                disabled={(!startTime && timerMode === 'pomodoro') && stopwatchSeconds === 0}
                className={`
                  p-4 rounded-full bg-white shadow-md transition-all active:scale-95 border border-gray-100 group relative
                  ${((startTime || isActive) || stopwatchSeconds > 0) ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-gray-300 cursor-not-allowed'}
                `}
                title="Finish & Save Session"
              >
                <CheckCircle size={24} />
              </button>
            </div>

            {/* Session Details Input */}
            <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-lg border border-gray-100 mt-8">
              <div className="flex items-center gap-2 mb-4 text-gray-500 text-sm font-medium uppercase tracking-wide">
                <Tag size={14} /> Session Notes
              </div>
              
              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="What are you working on?"
                    value={currentNotes}
                    onChange={(e) => setCurrentNotes(e.target.value)}
                    className="w-full text-lg font-medium placeholder-gray-300 border-none focus:ring-0 p-0 text-gray-800 bg-transparent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2 min-h-[28px]">
                    {currentTags.length === 0 && (
                      <span className="text-gray-400 text-sm italic py-1">No tags added yet</span>
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
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
          <Dashboard sessions={sessions} updateSession={handleUpdateSession} />
        )}
      </main>

      <Modal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        title="Settings"
      >
        <SettingsForm 
          settings={settings} 
          onSave={handleSaveSettings}
          onCancel={() => setIsSettingsOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        title="Create New Project"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input 
              type="text" 
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g., Client Work, Learning"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Color</label>
            <div className="flex gap-3">
              {(Object.keys(PROJECT_COLORS) as ProjectColor[]).map((c) => (
                 <button
                  key={c}
                  onClick={() => setNewProjectColor(c)}
                  className={`
                    w-10 h-10 rounded-full transition-all flex items-center justify-center
                    ${PROJECT_COLORS[c].primary} 
                    ${newProjectColor === c ? 'ring-4 ring-offset-2 ring-gray-200 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}
                  `}
                >
                  {newProjectColor === c && <CheckCircle size={16} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
             <Button variant="secondary" onClick={() => setIsNewProjectModalOpen(false)}>Cancel</Button>
             <Button onClick={createProject} disabled={!newProjectName.trim()}>Create Project</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        title="Delete Project?"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{projectToDelete?.name}</strong>?
          </p>
          <p className="text-sm text-gray-500">
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