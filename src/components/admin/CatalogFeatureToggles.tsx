'use client';

import React from 'react';
import { getCatalogFeaturesForUi } from '@/config/modules';

export interface CatalogFeatureTogglesProps {
  values: Record<string, boolean | undefined>;
  onChange: (featureKey: string, enabled: boolean) => void;
  disabled?: boolean;
  enabledModuleKeys?: string[] | null;
}

export default function CatalogFeatureToggles({
  values,
  onChange,
  disabled = false,
  enabledModuleKeys = null,
}: CatalogFeatureTogglesProps) {
  const features = getCatalogFeaturesForUi().filter((feature) => {
    if (!enabledModuleKeys) return true;
    return enabledModuleKeys.includes(feature.moduleKey);
  });

  const groups = features.reduce((acc, feature) => {
    const list = acc.get(feature.moduleKey) || [];
    list.push(feature);
    acc.set(feature.moduleKey, list);
    return acc;
  }, new Map<string, typeof features>());

  if (groups.size === 0) return null;

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([moduleKey, items]) => (
        <div key={moduleKey} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
          <h4 className="text-sm font-medium text-slate-900 mb-1">
            {items[0]?.moduleLabel} — Permissões específicas
          </h4>
          <div className="flex flex-col gap-3 mt-3">
            {items.map((feature) => (
              <label key={feature.key} className="flex items-start gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={!!values[feature.key]}
                  disabled={disabled}
                  onChange={(e) => onChange(feature.key, e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                />
                <span>
                  {feature.title}
                  <span className="block text-xs text-slate-500">{feature.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
