import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Calendar, Tag, Clock, TrendingUp, Sparkles, Filter, Pencil, X, Plus, CalendarDays } from 'lucide-react';
import { Session, AnalyticsPeriod } from '../types';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { PROJECT_COLORS } from '../constants';

interface DashboardProps {
  sessions: Session[];
  updateSession: (updatedSession: Session) => void;
  deleteSession: (sessionId: string) => void;
  darkMode?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ sessions, updateSession, deleteSession, darkMode = false }) => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('all');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('');
  
  // Edit Session State
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newEditTag, setNewEditTag] = useState('');

  const filteredSessions = useMemo(() => {
    let filtered = [...sessions];
    
    // Time filter
    if (period !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      if (period === 'day') {
        filtered = filtered.filter(s => s.endTime >= todayStart);
      } else if (period === 'last7days') {
        const last7DaysStart = Date.now() - (7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(s => s.endTime >= last7DaysStart);
      } else if (period === 'last30days') {
        const last30DaysStart = Date.now() - (30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(s => s.endTime >= last30DaysStart);
      }
    }

    // Tag filter
    if (filterTag) {
      filtered = filtered.filter(s => s.tags.some(t => t.toLowerCase().includes(filterTag.toLowerCase())));
    }

    return filtered.sort((a, b) => b.endTime - a.endTime); // Newest first
  }, [sessions, period, filterTag]);

  const totalTime = useMemo(() => {
    return filteredSessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
  }, [filteredSessions]);

  // Yesterday's sessions and summary
  const yesterdaySessions = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - (24 * 60 * 60 * 1000);
    
    return sessions.filter(s => {
      const sessionDate = new Date(s.endTime);
      const sessionDayStart = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate()).getTime();
      return sessionDayStart >= yesterdayStart && sessionDayStart < todayStart;
    });
  }, [sessions]);

  const yesterdayTotalTime = useMemo(() => {
    return yesterdaySessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
  }, [yesterdaySessions]);

  const yesterdayByProject = useMemo(() => {
    const grouped: Record<string, { time: number; sessions: Session[] }> = {};
    yesterdaySessions.forEach(s => {
      const projectName = s.projectName || 'Unknown';
      if (!grouped[projectName]) {
        grouped[projectName] = { time: 0, sessions: [] };
      }
      grouped[projectName].time += s.durationSeconds;
      grouped[projectName].sessions.push(s);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.time - a.time);
  }, [yesterdaySessions]);

  // Helper function to get last work day where activity was logged (any day, not today)
  const getLastWorkDay = useMemo(() => {
    // Get today's date at midnight
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayTime = today.getTime();
    
    // Get all unique days with sessions (excluding today)
    const dayDates: Date[] = [];
    const seenDays = new Set<string>();
    
    sessions.forEach(s => {
      const date = new Date(s.endTime);
      // Normalize to midnight in local timezone
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      const normalizedDate = new Date(year, month, day);
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Only include days that are not today and haven't been seen yet
      if (!seenDays.has(dateKey) && normalizedDate.getTime() < todayTime) {
        seenDays.add(dateKey);
        dayDates.push(normalizedDate);
      }
    });

    // Sort by date (newest first) and get the most recent
    dayDates.sort((a, b) => b.getTime() - a.getTime());
    
    let foundWorkDay: Date;
    if (dayDates.length > 0) {
      foundWorkDay = dayDates[0];
    } else {
      // If no work day found, use yesterday
      foundWorkDay = new Date(today);
      foundWorkDay.setDate(foundWorkDay.getDate() - 1);
    }
    
    const dayStart = new Date(foundWorkDay.getFullYear(), foundWorkDay.getMonth(), foundWorkDay.getDate()).getTime();
    const dayEnd = dayStart + (24 * 60 * 60 * 1000);
    
    return {
      date: foundWorkDay,
      dayStart,
      dayEnd,
      dayName: foundWorkDay.toLocaleDateString('en-US', { weekday: 'long' }),
      dateString: foundWorkDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
  }, [sessions]);

  // Last work day sessions and summary
  const lastWorkDaySessions = useMemo(() => {
    return sessions.filter(s => {
      const sessionDate = new Date(s.endTime);
      // Normalize to midnight to match the logic in getLastWorkDay
      const sessionDayStart = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate()).getTime();
      return sessionDayStart >= getLastWorkDay.dayStart && sessionDayStart < getLastWorkDay.dayEnd;
    });
  }, [sessions, getLastWorkDay]);

  const lastWorkDayTotalTime = useMemo(() => {
    return lastWorkDaySessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
  }, [lastWorkDaySessions]);

  const lastWorkDayByProject = useMemo(() => {
    const grouped: Record<string, { time: number; sessions: Session[] }> = {};
    lastWorkDaySessions.forEach(s => {
      const projectName = s.projectName || 'Unknown';
      if (!grouped[projectName]) {
        grouped[projectName] = { time: 0, sessions: [] };
      }
      grouped[projectName].time += s.durationSeconds;
      grouped[projectName].sessions.push(s);
    });
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.time - a.time);
  }, [lastWorkDaySessions]);

  // Stack bar chart data per project per day
  const projectKeys = useMemo(() => {
    const names = new Set<string>();
    filteredSessions.forEach(s => names.add(s.projectName || 'Unknown'));
    return Array.from(names);
  }, [filteredSessions]);

  const chartData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    filteredSessions.forEach(s => {
      const date = new Date(s.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[date]) grouped[date] = {};
      const key = s.projectName || 'Unknown';
      grouped[date][key] = (grouped[date][key] || 0) + (s.durationSeconds / 60);
    });

    return Object.entries(grouped).map(([date, projects]) => {
      const entry: Record<string, any> = { date };
      Object.entries(projects).forEach(([name, mins]) => {
        entry[name] = Math.round(mins); // round minutes for display
      });
      return entry;
    }).reverse(); // Oldest first for chart
  }, [filteredSessions]);

  const pieData = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredSessions.forEach(s => {
      const name = s.projectName || 'Unknown Project';
      grouped[name] = (grouped[name] || 0) + (s.durationSeconds / 60);
    });
    // Filter out very small values only if completely zero, otherwise show decimals
    return Object.entries(grouped).map(([name, value]) => ({ 
      name, 
      value: parseFloat(value.toFixed(2)) 
    })).filter(item => item.value > 0);
  }, [filteredSessions]);

  // Color palette for charts
  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#6366f1'];

  // Session duration distribution data
  const durationDistribution = useMemo(() => {
    const buckets = [
      { label: '0-15 min', min: 0, max: 15 },
      { label: '15-30 min', min: 15, max: 30 },
      { label: '30-60 min', min: 30, max: 60 },
      { label: '1-2 hrs', min: 60, max: 120 },
      { label: '2-4 hrs', min: 120, max: 240 },
      { label: '4+ hrs', min: 240, max: Infinity }
    ];

    const counts = buckets.map(() => 0);
    const totalSessions = filteredSessions.length;

    filteredSessions.forEach(session => {
      const minutes = session.durationSeconds / 60;
      for (let i = 0; i < buckets.length; i++) {
        if (minutes >= buckets[i].min && minutes < buckets[i].max) {
          counts[i]++;
          break;
        }
      }
    });

    return buckets.map((bucket, index) => ({
      label: bucket.label,
      count: counts[index],
      percentage: totalSessions > 0 ? (counts[index] / totalSessions) * 100 : 0
    }));
  }, [filteredSessions]);

  const handleGetInsights = async () => {
    // Coming soon placeholder for AI insights in v1
    setLoadingAi(true);
    setAiInsight("AI insights are coming soon. Stay tuned!");
    setLoadingAi(false);
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`; // Show minutes even if 0 for consistency in top card? 
    // Actually if < 1 min, show "< 1m" or "0m"
    if (h === 0 && m === 0) return "< 1m";
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatMinutes = (minutes: number): string => {
    const roundedMins = Math.ceil(minutes);
    if (roundedMins < 60) {
      return `${roundedMins} mins`;
    } else {
      const hours = Math.floor(roundedMins / 60);
      const mins = roundedMins % 60;
      const hourLabel = hours === 1 ? 'hr' : 'hrs';
      return `${hours} ${hourLabel} ${mins.toString().padStart(2, '0')} mins`;
    }
  };

  const openEditModal = (session: Session) => {
    setEditingSession(session);
    setEditNotes(session.notes || '');
    setEditTags(session.tags || []);
  };

  const saveEdit = () => {
    if (!editingSession) return;
    updateSession({
      ...editingSession,
      notes: editNotes,
      tags: editTags
    });
    setEditingSession(null);
  };

  const addEditTag = () => {
    if (newEditTag.trim() && !editTags.includes(newEditTag.trim())) {
      setEditTags([...editTags, newEditTag.trim()]);
      setNewEditTag('');
    }
  };

  const removeEditTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
  };

  const getPeriodLabel = (period: AnalyticsPeriod): string => {
    switch (period) {
      case 'day': return 'Today';
      case 'last7days': return 'Last 7 Days';
      case 'last30days': return 'Last 30 Days';
      case 'all': return 'All Time';
      default: return period;
    }
  };

  // GitHub-style heatmap data (71 days: today + previous 70 days)
  const heatmapData = useMemo(() => {
    // Calculate total time per day
    const dayData: Record<string, number> = {}; // dateKey -> total minutes
    sessions.forEach(s => {
      const date = new Date(s.endTime);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const minutes = Math.round(s.durationSeconds / 60);
      dayData[dateKey] = (dayData[dateKey] || 0) + minutes;
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 70); // 70 days back (71 days total including today)

    // Get max value for intensity scaling
    const maxMinutes = Math.max(...Object.values(dayData), 1);
    
    // Get intensity level (0-4, similar to GitHub)
    const getIntensity = (minutes: number): number => {
      if (minutes === 0) return 0;
      const ratio = minutes / maxMinutes;
      if (ratio <= 0.25) return 1;
      if (ratio <= 0.5) return 2;
      if (ratio <= 0.75) return 3;
      return 4;
    };

    // Create array of all days
    const allDays: Array<{ date: Date; minutes: number; intensity: number; dateKey: string; isToday: boolean }> = [];
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate();
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const minutes = dayData[dateKey] || 0;
      const dateNormalized = new Date(year, currentDate.getMonth(), day);
      const isToday = dateNormalized.getTime() === today.getTime();
      
      allDays.push({
        date: new Date(dateNormalized),
        minutes,
        intensity: getIntensity(minutes),
        dateKey,
        isToday
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Organize into weeks (columns) with days of week (rows)
    // GitHub style: Sunday=0 (top), Saturday=6 (bottom)
    const weeks: Array<Array<{ date: Date; minutes: number; intensity: number; dateKey: string; isToday: boolean } | null>> = [];
    
    // Find the first Sunday before or on startDate
    const firstDate = new Date(startDate);
    const dayOfWeek = firstDate.getDay();
    const daysToSubtract = dayOfWeek; // Days to go back to Sunday
    const firstSunday = new Date(firstDate);
    firstSunday.setDate(firstSunday.getDate() - daysToSubtract);

    // Build weeks - each week is a column (Sunday to Saturday)
    // Only include weeks that have at least one day in our range
    let currentWeekStart = new Date(firstSunday);
    const todayTime = today.getTime();
    
    while (currentWeekStart <= today) {
      const week: Array<{ date: Date; minutes: number; intensity: number; dateKey: string; isToday: boolean } | null> = [];
      let hasDaysInRange = false;
      
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const weekDayDate = new Date(currentWeekStart);
        weekDayDate.setDate(weekDayDate.getDate() + dayOfWeek);
        const weekDayTime = weekDayDate.getTime();
        
        if (weekDayTime < startDate.getTime()) {
          week.push(null); // Before range
        } else if (weekDayTime > todayTime) {
          week.push(null); // After range - don't show future days
        } else {
          hasDaysInRange = true;
          const year = weekDayDate.getFullYear();
          const month = weekDayDate.getMonth() + 1;
          const day = weekDayDate.getDate();
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayInfo = allDays.find(d => d.dateKey === dateKey);
          week.push(dayInfo || {
            date: new Date(weekDayDate),
            minutes: 0,
            intensity: 0,
            dateKey,
            isToday: weekDayTime === todayTime
          });
        }
      }
      
      // Only add week if it has days in our range
      if (hasDaysInRange) {
        weeks.push(week);
      }
      
      // Move to next week
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      
      // Stop if we've passed today
      if (currentWeekStart.getTime() > todayTime) {
        break;
      }
    }

    // Get month labels (show first occurrence of each month in the range)
    const monthLabels: Array<{ weekIndex: number; month: string }> = [];
    const seenMonths = new Set<string>();
    
    weeks.forEach((week, weekIndex) => {
      // Find the first non-null day in this week
      const firstDay = week.find(day => day !== null);
      if (firstDay) {
        const monthKey = `${firstDay.date.getFullYear()}-${firstDay.date.getMonth()}`;
        // Show month label on the first week that contains a day from this month
        // Check if this is the first occurrence of this month
        if (!seenMonths.has(monthKey)) {
          seenMonths.add(monthKey);
          monthLabels.push({
            weekIndex,
            month: firstDay.date.toLocaleDateString('en-US', { month: 'short' })
          });
        }
      }
    });

    return { weeks, monthLabels, maxMinutes };
  }, [sessions]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* Last Work Day Summary */}
      <div className={`rounded-2xl shadow-lg border overflow-hidden ${
        darkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
      }`}>
        <div className={`p-6 border-b ${
          darkMode ? 'border-gray-700' : 'border-blue-200'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <CalendarDays className={darkMode ? 'text-blue-400' : 'text-blue-600'} size={24} />
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              Last Work Day Summary
            </h2>
          </div>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {lastWorkDaySessions.length === 0
              ? `No sessions recorded on ${getLastWorkDay.dayName}, ${getLastWorkDay.dateString}`
              : `${lastWorkDaySessions.length} session${lastWorkDaySessions.length !== 1 ? 's' : ''} completed on ${getLastWorkDay.dayName}, ${getLastWorkDay.dateString}`
            }
          </p>
        </div>
        
        {lastWorkDaySessions.length > 0 ? (
          <div className="p-6 space-y-4">
            {/* Total Time Card */}
            <div className={`p-4 rounded-xl border ${
              darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-blue-200'
            }`}>
              <div className={`flex items-center justify-between ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <span className="font-medium">Total Time</span>
                <span className={`text-3xl font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {formatDuration(lastWorkDayTotalTime)}
                </span>
              </div>
            </div>

            {/* Breakdown by Project */}
            <div>
              <h3 className={`font-semibold text-sm uppercase tracking-wide mb-3 ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Time by Project
              </h3>
              <div className="space-y-2">
                {lastWorkDayByProject.map(({ name, time, sessions: projectSessions }) => {
                  const percentage = (time / lastWorkDayTotalTime) * 100;
                  const session = projectSessions[0];
                  const colorTheme = PROJECT_COLORS[session?.color] || PROJECT_COLORS.blue;
                  return (
                    <div 
                      key={name}
                      className={`p-4 rounded-lg border ${
                        darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${colorTheme.primary}`}></div>
                          <span className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {name}
                          </span>
                        </div>
                        <span className={`font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          {formatDuration(time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`flex-1 h-2 rounded-full overflow-hidden ${
                          darkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`}>
                          <div 
                            className={`h-full ${colorTheme.primary}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                      {projectSessions.length > 0 && (
                        <div className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {projectSessions.length} session{projectSessions.length !== 1 ? 's' : ''}
                          {projectSessions.some(s => s.notes) && (
                            <span className="ml-2">
                              • {projectSessions.filter(s => s.notes).map(s => s.notes).slice(0, 2).join(', ')}
                              {projectSessions.filter(s => s.notes).length > 2 && '...'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className={`p-6 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <Clock size={48} className={`mx-auto mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
            <p>No time tracked on {getLastWorkDay.dayName}, {getLastWorkDay.dateString}. Start a session to see your progress!</p>
          </div>
        )}
      </div>

      {/* Heatmap and Duration Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar View - GitHub Style Heatmap */}
        <div className={`p-6 rounded-2xl shadow-sm border min-h-[300px] ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <div className="mb-6">
            <h3 className={`font-bold text-lg ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Activity Heatmap</h3>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Last 71 days of activity
            </p>
          </div>
          <div>
            <div className="flex gap-2 items-start">
              {/* Day labels on the left - moved down by one row */}
              <div className="flex flex-col gap-2 pr-3 flex-shrink-0">
                {/* Spacer to move labels down by one row (matches month labels row height + margin) */}
                <div className="h-7"></div>
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, idx) => (
                  <div key={idx} className={`h-5 flex items-center justify-end text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Heatmap grid */}
              <div className="flex-1 min-w-0">
                {/* Month labels at the top */}
                <div className="flex gap-2 mb-2">
                  {heatmapData.weeks.map((week, weekIndex) => {
                    const monthLabel = heatmapData.monthLabels.find(m => m.weekIndex === weekIndex);
                    return (
                      <div key={weekIndex} className="w-5 flex items-start justify-center">
                        {monthLabel && (
                          <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {monthLabel.month.toUpperCase()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Heatmap grid */}
                <div className="flex gap-2">
                  {heatmapData.weeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="flex flex-col gap-2">
                        {week.map((day, dayIndex) => {
                          if (day === null) {
                            return <div key={dayIndex} className="w-5 h-5"></div>;
                          }
                          
                          // GitHub-style color intensity (green shades) - today uses same green colors
                          // Make no-activity cells more visible with border
                          const getColor = (intensity: number) => {
                            switch (intensity) {
                              case 0: return darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-gray-200 border border-gray-300';
                              case 1: return darkMode ? 'bg-green-900/60' : 'bg-green-100';
                              case 2: return darkMode ? 'bg-green-800/70' : 'bg-green-300';
                              case 3: return darkMode ? 'bg-green-700/80' : 'bg-green-500';
                              case 4: return darkMode ? 'bg-green-600' : 'bg-green-600';
                              default: return darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-gray-200 border border-gray-300';
                            }
                          };
                          
                          const hours = Math.floor(day.minutes / 60);
                          const mins = day.minutes % 60;
                          const timeStr = hours > 0 
                            ? `${hours}h ${mins}m` 
                            : `${mins}m`;
                          const dateStr = day.date.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          });
                          
                          return (
                            <div
                              key={dayIndex}
                              className={`w-5 h-5 rounded ${getColor(day.intensity)} transition-all hover:ring-2 hover:ring-blue-400 hover:scale-110 cursor-pointer ${day.isToday ? 'ring-2 ring-blue-400' : ''}`}
                              title={`${dateStr}${day.minutes > 0 ? `: ${timeStr}` : ': No activity'}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                </div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className={`font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Less</span>
                <div className="flex gap-1">
                  <div className={`w-5 h-5 rounded ${darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-gray-200 border border-gray-300'}`}></div>
                  <div className={`w-5 h-5 rounded ${darkMode ? 'bg-green-900/60' : 'bg-green-100'}`}></div>
                  <div className={`w-5 h-5 rounded ${darkMode ? 'bg-green-800/70' : 'bg-green-300'}`}></div>
                  <div className={`w-5 h-5 rounded ${darkMode ? 'bg-green-700/80' : 'bg-green-500'}`}></div>
                  <div className={`w-5 h-5 rounded ${darkMode ? 'bg-green-600' : 'bg-green-600'}`}></div>
                </div>
                <span className={`font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>More</span>
              </div>
            </div>
          </div>
        </div>

        {/* Session Duration Distribution Histogram */}
        <div className={`p-6 rounded-2xl shadow-sm border min-h-[300px] ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <div className="mb-6">
            <h3 className={`font-bold text-lg ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Session Duration Distribution</h3>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Distribution of session lengths
            </p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={durationDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#374151' : '#f0f0f0'} />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={11} 
                  tickMargin={10} 
                  stroke={darkMode ? '#9ca3af' : '#9ca3af'}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={12} 
                  stroke={darkMode ? '#9ca3af' : '#9ca3af'}
                  label={{ 
                    value: 'Sessions', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: darkMode ? '#9ca3af' : '#9ca3af' }
                  }}
                />
                <Tooltip 
                  cursor={{fill: darkMode ? '#111827' : '#f9fafb'}}
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                    backgroundColor: darkMode ? '#1f2937' : '#fff', 
                    color: darkMode ? '#e5e7eb' : '#111827' 
                  }}
                  formatter={(value: number, name: string, props: any) => {
                    const percentage = props.payload?.percentage || 0;
                    return [
                      `${value} session${value !== 1 ? 's' : ''} (${percentage.toFixed(1)}%)`,
                      'Count'
                    ];
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill={CHART_COLORS[0]} 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Global Period Selector */}
      <div className={`p-4 rounded-2xl shadow-sm border ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Calendar className={darkMode ? 'text-gray-400' : 'text-gray-500'} size={18} />
            <span className={`font-medium text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              View Period:
            </span>
          </div>
          <div className={`flex rounded-lg p-1 gap-1 flex-wrap ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            {(['day', 'last7days', 'last30days', 'all'] as AnalyticsPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  period === p 
                    ? (darkMode ? 'bg-gray-600 shadow text-gray-100' : 'bg-white shadow text-gray-900')
                    : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                }`}
              >
                {getPeriodLabel(p)}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-2xl shadow-sm border flex flex-col justify-between ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
        }`}>
          <div className={`flex items-center gap-3 mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <Clock size={20} />
            <span className="font-medium text-sm uppercase tracking-wide">Total Time</span>
          </div>
          <div className={`text-4xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            {formatDuration(totalTime)}
          </div>
        </div>

        <div className={`p-6 rounded-2xl shadow-sm border flex flex-col justify-between ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
        }`}>
          <div className={`flex items-center gap-3 mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <TrendingUp size={20} />
            <span className="font-medium text-sm uppercase tracking-wide">Sessions</span>
          </div>
          <div className={`text-4xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            {filteredSessions.length}
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className={`flex items-center gap-3 mb-2 ${darkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
              <Sparkles size={20} />
              <span className="font-medium text-sm uppercase tracking-wide">AI Analysis</span>
            </div>
            <p className={`text-sm mb-3 line-clamp-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
               {aiInsight ? "Analysis complete." : "Get insights on your project habits."}
            </p>
            <Button 
              size="sm" 
              onClick={handleGetInsights} 
              disabled={loadingAi || sessions.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto text-xs"
            >
              {loadingAi ? 'Working...' : aiInsight ? 'View Message' : 'Coming Soon'}
            </Button>
          </div>
        </div>
      </div>

      {/* AI Insight Result */}
      {aiInsight && (
        <div className={`p-6 rounded-2xl shadow-sm border border-l-4 border-l-indigo-500 ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-indigo-100'
        }`}>
           <h3 className={`font-bold text-lg mb-2 ${darkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>Coach's Insight</h3>
           <div className={`prose prose-sm max-w-none whitespace-pre-line ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
             {aiInsight}
           </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className={`p-6 rounded-2xl shadow-sm border min-h-[300px] ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <div className="mb-6">
            <h3 className={`font-bold text-lg ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Activity Timeline</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#374151' : '#f0f0f0'} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} stroke={darkMode ? '#9ca3af' : '#9ca3af'} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} stroke={darkMode ? '#9ca3af' : '#9ca3af'} />
                <Tooltip 
                  cursor={{fill: darkMode ? '#111827' : '#f9fafb'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: darkMode ? '#1f2937' : '#fff', color: darkMode ? '#e5e7eb' : '#111827' }}
                  formatter={(value: number, name: string) => [formatMinutes(value), name]}
                />
                <Legend />
                {projectKeys.map((key, idx) => {
                  const palette = ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f87171', '#fb7185', '#22d3ee', '#c084fc', '#fbbf24'];
                  const fill = palette[idx % palette.length];
                  return (
                    <Bar key={key} dataKey={key} stackId="time" fill={fill} radius={[4, 4, 0, 0]} />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className={`p-6 rounded-2xl shadow-sm border min-h-[300px] ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
        }`}>
           <h3 className={`font-bold text-lg mb-6 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Time per Project</h3>
           <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string, props: any) => {
                  const projectName = props.payload?.name || name;
                  return [formatMinutes(value), projectName];
                }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* History */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        <div className={`p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
          darkMode ? 'border-gray-700' : 'border-gray-100'
        }`}>
          <h3 className={`font-bold text-lg ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>History</h3>
          <div className="relative">
             <Filter className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} size={16} />
             <input 
              type="text" 
              placeholder="Filter by tag..."
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className={`pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 w-full sm:w-64 ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:ring-gray-500' 
                  : 'border-gray-200 focus:ring-gray-200'
              }`}
             />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className={`text-xs uppercase tracking-wider font-semibold ${
              darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-500'
            }`}>
              <tr>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Notes</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Tags</th>
                <th className="px-2 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className={darkMode ? 'divide-y divide-gray-700' : 'divide-y divide-gray-100'}>
              {filteredSessions.length > 0 ? filteredSessions.map(session => {
                const colorTheme = PROJECT_COLORS[session.color] || PROJECT_COLORS.blue;
                return (
                  <tr key={session.id} className={`transition-colors group ${
                    darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50/50'
                  }`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${colorTheme.primary}`}></div>
                        <span className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{session.projectName}</span>
                      </div>
                    </td>
                     <td className={`px-6 py-4 text-sm max-w-[200px] truncate ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {session.notes || '-'}
                    </td>
                    <td className={`px-6 py-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        {new Date(session.endTime).toLocaleDateString()}
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {session.startTime ? new Date(session.startTime).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      }) : '-'}
                    </td>
                    <td className={`px-6 py-4 text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      {(() => {
                        const totalMinutes = Math.ceil(session.durationSeconds / 60);
                        if (totalMinutes < 60) {
                          return `${totalMinutes} mins`;
                        } else {
                          const hours = Math.floor(totalMinutes / 60);
                          const mins = totalMinutes % 60;
                          const hourLabel = hours === 1 ? 'hr' : 'hrs';
                          return `${hours} ${hourLabel} ${mins.toString().padStart(2, '0')} mins`;
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {session.tags.map(tag => (
                          <span key={tag} className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                            darkMode 
                              ? 'bg-gray-700 text-gray-300' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <Tag size={10} className="mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-4 w-12">
                      <button 
                        onClick={() => openEditModal(session)}
                        className={`p-1 rounded transition-all ${
                          darkMode 
                            ? 'text-gray-500 hover:text-blue-400 hover:bg-blue-900/30' 
                            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                        title="Edit Session"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className={`px-6 py-12 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No sessions found in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Session Modal */}
      <Modal
        isOpen={!!editingSession}
        onClose={() => setEditingSession(null)}
        title="Edit Session"
      >
        <div className="space-y-4">
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
             <textarea 
               value={editNotes}
               onChange={(e) => setEditNotes(e.target.value)}
               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[100px]"
               placeholder="Add notes..."
             />
           </div>

           <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
             <div className="flex flex-wrap gap-2 mb-2">
               {editTags.map(tag => (
                 <span key={tag} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-sm font-medium">
                   #{tag}
                   <button onClick={() => removeEditTag(tag)} className="ml-1 hover:text-red-500">
                     <X size={12} />
                   </button>
                 </span>
               ))}
             </div>
             <div className="flex gap-2">
               <input
                 type="text"
                 value={newEditTag}
                 onChange={(e) => setNewEditTag(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && addEditTag()}
                 placeholder="New tag..."
                 className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
               />
               <Button size="sm" onClick={addEditTag} disabled={!newEditTag.trim()}>
                 <Plus size={16} />
               </Button>
             </div>
           </div>

          <div className={`flex justify-end gap-3 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <Button variant="danger" onClick={() => {
              if (editingSession && window.confirm("Are you sure you want to delete this session?")) {
                deleteSession(editingSession.id);
                setEditingSession(null);
              }
            }}>
              Delete Session
            </Button>
            <Button variant="secondary" onClick={() => setEditingSession(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};