export type ProjectColor = 'red' | 'green' | 'purple' | 'blue' | 'yellow';

export interface Project {
  id: string;
  name: string;
  color: ProjectColor;
}

export interface ColorTheme {
  primary: string; // Main background/button color
  secondary: string; // Light background for tags/accents
  ring: string; // Timer ring color
  text: string; // Text color on light backgrounds
  accent: string; // Strong text color
}

export interface Session {
  id: string;
  projectId: string;
  projectName: string;
  startTime: number; // timestamp
  endTime: number; // timestamp
  durationSeconds: number;
  notes: string;
  tags: string[];
  color: ProjectColor;
}

export interface Settings {
  timerDuration: number; // minutes
  darkMode: boolean;
}

export type AnalyticsPeriod = 'day' | 'last7days' | 'last30days' | 'all';

export interface ActiveTimer {
  id: string; // User ID (one timer per user)
  mode: 'pomodoro' | 'stopwatch';
  isActive: boolean;
  startTime: number; // Server timestamp when timer started
  pausedAt?: number; // Server timestamp when paused (for resume calculation)
  pausedDuration: number; // Total paused time in seconds
  initialDuration?: number; // For pomodoro: total duration in seconds
  projectId: string;
  projectName: string;
  notes: string;
  tags: string[];
}
