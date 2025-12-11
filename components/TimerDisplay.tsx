import React from 'react';
import { ColorTheme } from '../types';

interface TimerDisplayProps {
  seconds: number; // For pomodoro: time remaining. For stopwatch: time elapsed.
  totalTime: number; // Only used for pomodoro progress
  colorTheme: ColorTheme;
  isActive: boolean;
  mode: 'pomodoro' | 'stopwatch';
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ seconds, totalTime, colorTheme, isActive, mode }) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  
  let progress = 0;
  if (mode === 'pomodoro') {
    progress = totalTime > 0 ? (seconds / totalTime) : 0;
  } else {
    // For stopwatch, loop the ring every 60 seconds
    progress = secs / 60;
  }
  
  // Pomodoro counts down (ring empties), Stopwatch counts up (ring fills)
  const dashoffset = mode === 'pomodoro' 
    ? circumference * (1 - progress) 
    : circumference * (1 - progress); 

  return (
    <div className="relative flex items-center justify-center mt-4 mb-4">
      <div className="relative">
        <svg className="transform -rotate-90 w-72 h-72 sm:w-80 sm:h-80 drop-shadow-xl">
          {/* Background Ring */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-gray-100"
          />
          
          {/* Progress Ring */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            className={`transition-all duration-1000 ease-linear ${colorTheme.ring} ${isActive ? 'opacity-100' : 'opacity-90'}`}
          />
        </svg>
        
        {/* Digital Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none z-20">
          <span className={`text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-none ${colorTheme.accent} transition-colors duration-300`}>
            {minutes.toString().padStart(2, '0')}
            <span className="opacity-30 mx-1">:</span>
            {secs.toString().padStart(2, '0')}
          </span>
          <span className={`text-sm font-semibold uppercase tracking-widest mt-4 text-gray-400`}>
            {mode === 'stopwatch' ? (isActive ? 'Counting Up' : 'Paused') : (isActive ? 'Focusing' : 'Paused')}
          </span>
        </div>
      </div>
    </div>
  );
};