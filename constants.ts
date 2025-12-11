import { ProjectColor, ColorTheme, Settings, Project } from './types';

export const PROJECT_COLORS: Record<ProjectColor, ColorTheme> = {
  red: {
    primary: 'bg-red-500',
    secondary: 'bg-red-50',
    ring: 'stroke-red-500',
    text: 'text-red-900',
    accent: 'text-red-600'
  },
  green: {
    primary: 'bg-emerald-500',
    secondary: 'bg-emerald-50',
    ring: 'stroke-emerald-500',
    text: 'text-emerald-900',
    accent: 'text-emerald-600'
  },
  purple: {
    primary: 'bg-purple-600',
    secondary: 'bg-purple-50',
    ring: 'stroke-purple-600',
    text: 'text-purple-900',
    accent: 'text-purple-700'
  },
  blue: {
    primary: 'bg-blue-500',
    secondary: 'bg-blue-50',
    ring: 'stroke-blue-500',
    text: 'text-blue-900',
    accent: 'text-blue-600'
  },
  yellow: {
    primary: 'bg-yellow-400',
    secondary: 'bg-yellow-50',
    ring: 'stroke-yellow-400',
    text: 'text-yellow-900',
    accent: 'text-yellow-700'
  }
};

export const DEFAULT_SETTINGS: Settings = {
  timerDuration: 25,
};

export const DEFAULT_PROJECTS: Project[] = [
  { id: 'default-1', name: 'Deep Work', color: 'purple' },
  { id: 'default-2', name: 'Study', color: 'blue' },
  { id: 'default-3', name: 'Creative', color: 'yellow' }
];
