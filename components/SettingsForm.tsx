import React from 'react';
import { Settings } from '../types';
import { Button } from './ui/Button';

interface SettingsFormProps {
  settings: Settings;
  onSave: (newSettings: Settings) => void;
  onCancel: () => void;
  darkMode?: boolean;
}

export const SettingsForm: React.FC<SettingsFormProps> = ({ settings, onSave, onCancel, darkMode = false }) => {
  const [formData, setFormData] = React.useState<Settings>(settings);

  // Sync form data when settings prop changes
  React.useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (field: keyof Settings, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    // Auto-save immediately, especially for darkMode
    onSave(updated);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className={`text-sm font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Timer Configuration</h3>
        <div>
          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Default Duration (Minutes)</label>
          <input 
            type="number" 
            value={formData.timerDuration}
            onChange={(e) => handleChange('timerDuration', Number(e.target.value))}
            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-100' 
                : 'border-gray-300'
            }`}
            min="1"
            max="180"
          />
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Changes will apply to the next session.</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className={`text-sm font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Dark Mode</label>
            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Switch to a dark theme for better viewing in low light</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('darkMode', !formData.darkMode)}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${formData.darkMode ? 'bg-blue-600' : 'bg-gray-300'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${formData.darkMode ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      </div>

      <div className={`flex justify-end gap-3 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
        <Button variant="secondary" onClick={onCancel}>Close</Button>
      </div>
    </div>
  );
};
