import React from 'react';
import { Settings } from '../types';
import { Button } from './ui/Button';

interface SettingsFormProps {
  settings: Settings;
  onSave: (newSettings: Settings) => void;
  onCancel: () => void;
}

export const SettingsForm: React.FC<SettingsFormProps> = ({ settings, onSave, onCancel }) => {
  const [formData, setFormData] = React.useState<Settings>(settings);

  const handleChange = (field: keyof Settings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Timer Configuration</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Duration (Minutes)</label>
          <input 
            type="number" 
            value={formData.timerDuration}
            onChange={(e) => handleChange('timerDuration', Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            min="1"
            max="180"
          />
          <p className="text-xs text-gray-400 mt-1">Changes will apply to the next session.</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formData)}>Save Changes</Button>
      </div>
    </div>
  );
};
