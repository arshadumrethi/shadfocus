import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Calendar, Tag, Clock, TrendingUp, Sparkles, Filter, Pencil, X, Plus } from 'lucide-react';
import { Session, AnalyticsPeriod } from '../types';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { PROJECT_COLORS } from '../constants';

interface DashboardProps {
  sessions: Session[];
  updateSession: (updatedSession: Session) => void;
  darkMode?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ sessions, updateSession, darkMode = false }) => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
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
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    if (period === 'day') {
      filtered = filtered.filter(s => s.endTime >= todayStart);
    } else if (period === 'week') {
      const weekStart = todayStart - (7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(s => s.endTime >= weekStart);
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      filtered = filtered.filter(s => s.endTime >= monthStart);
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

  const chartData = useMemo(() => {
    // Group by Date
    const grouped: Record<string, number> = {};
    filteredSessions.forEach(s => {
      const date = new Date(s.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      // Keep precision for short sessions (don't round to 0 yet)
      grouped[date] = (grouped[date] || 0) + (s.durationSeconds / 60);
    });

    return Object.entries(grouped).map(([date, minutes]) => ({
      date,
      minutes: parseFloat(minutes.toFixed(2)) // Keep 2 decimal places for chart
    })).reverse(); // Oldest first for chart
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
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

      {/* History (Moved Up) */}
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
                <th className="px-6 py-4 text-right">Edit</th>
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
                      {Math.ceil(session.durationSeconds / 60)} min
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
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => openEditModal(session)}
                        className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                          darkMode 
                            ? 'text-gray-500 hover:text-blue-400 hover:bg-blue-900/30' 
                            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                        title="Edit Session"
                      >
                        <Pencil size={16} />
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

      {/* Charts Section (Moved Down) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[300px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-800 text-lg">Activity Timeline</h3>
            <div className={`flex rounded-lg p-1 gap-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              {(['day', 'week', 'month'] as AnalyticsPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    period === p 
                      ? (darkMode ? 'bg-gray-600 shadow text-gray-100' : 'bg-white shadow text-gray-900')
                      : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} stroke="#9ca3af" />
                <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#9ca3af" />
                <Tooltip 
                  cursor={{fill: '#f9fafb'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value} mins`, 'Duration']}
                />
                <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
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
                <Tooltip formatter={(value: number) => [`${value} mins`, 'Duration']} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
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

           <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
             <Button variant="secondary" onClick={() => setEditingSession(null)}>Cancel</Button>
             <Button onClick={saveEdit}>Save Changes</Button>
           </div>
        </div>
      </Modal>

    </div>
  );
};