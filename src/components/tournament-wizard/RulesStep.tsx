"use client";

import { getGameDefaults } from "@/lib/game-defaults";

export interface RulesData {
  description: string;
  match_rules: string;
}

interface RulesStepProps {
  gameType: string;
  data: RulesData;
  onChange: (data: Partial<RulesData>) => void;
  errors?: Record<string, string>;
}

export default function RulesStep({ gameType, data, onChange, errors = {} }: RulesStepProps) {
  const gameDefaults = getGameDefaults(gameType);

  const handleApplyDefaultRules = () => {
    onChange({ match_rules: gameDefaults.default_rules });
  };

  const handleApplyDefaultDescription = () => {
    onChange({ description: gameDefaults.default_description });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Description & Rules
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Customize the tournament description and match rules
        </p>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tournament Description *
          </label>
          <button
            type="button"
            onClick={handleApplyDefaultDescription}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 
                      dark:hover:text-indigo-300 font-medium"
          >
            Use Default Template
          </button>
        </div>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe your tournament to attract participants..."
          rows={4}
          className={`w-full px-4 py-3 border rounded-xl 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                    placeholder-gray-400 resize-none
                    focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                    ${errors.description ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
        />
        {errors.description ? (
          <p className="mt-1 text-sm text-red-500">{errors.description}</p>
        ) : (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {data.description.length}/2000 characters
          </p>
        )}
      </div>

      {/* Match Rules */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Match Rules
          </label>
          <button
            type="button"
            onClick={handleApplyDefaultRules}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 
                      dark:hover:text-indigo-300 font-medium"
          >
            Use {gameDefaults.display_name} Template
          </button>
        </div>
        <textarea
          value={data.match_rules}
          onChange={(e) => onChange({ match_rules: e.target.value })}
          placeholder="Define match rules, scoring system, requirements..."
          rows={12}
          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                    placeholder-gray-400 font-mono text-sm resize-none
                    focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {data.match_rules.length}/5000 characters • Supports Markdown formatting
        </p>
      </div>

      {/* Tips */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2">💡 Tips for Great Rules</h4>
        <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
          <li>• Clearly explain the scoring system (kills, placement points)</li>
          <li>• Specify device/platform requirements</li>
          <li>• Include check-in and match start procedures</li>
          <li>• Define what counts as cheating/rule violations</li>
          <li>• Explain how disputes will be resolved</li>
        </ul>
      </div>
    </div>
  );
}
