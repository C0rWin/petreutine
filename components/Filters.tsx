import React from 'react';

import { AnimalType } from '../types';
import AddressAutocomplete from './AddressAutocomplete';

export type DatePreset = 'all' | '24h' | 'week' | '2weeks' | 'month' | 'custom';

export interface FilterState {
  animalType: AnimalType | 'ALL';
  location: string;
  lat?: number;
  lon?: number;
  radiusKm: number | 'ANY';
  datePreset: DatePreset;
  customDate: string; // YYYY-MM-DD when datePreset === 'custom'
  status: 'ALL' | 'OPEN' | 'RESOLVED';
}

export const DEFAULT_FILTERS: FilterState = {
  animalType: 'ALL',
  location: '',
  radiusKm: 'ANY',
  datePreset: 'all',
  customDate: '',
  status: 'ALL',
};

export function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.animalType !== 'ALL') n++;
  if (f.location.trim()) n++;
  if (f.datePreset !== 'all') n++;
  if (f.status !== 'ALL') n++;
  return n;
}

const animalLabels: Record<AnimalType | 'ALL', string> = {
  ALL: 'Все',
  [AnimalType.DOG]: 'Собаки',
  [AnimalType.CAT]: 'Кошки',
  [AnimalType.BIRD]: 'Птицы',
  [AnimalType.OTHER]: 'Другие',
};

const datePresets: DatePreset[] = ['all', '24h', 'week', '2weeks', 'month', 'custom'];
const dateLabels: Record<DatePreset, string> = {
  all: 'За всё время',
  '24h': '24 часа',
  week: 'Неделя',
  '2weeks': '2 недели',
  month: 'Месяц',
  custom: 'Выбрать дату',
};

const statuses: FilterState['status'][] = ['ALL', 'OPEN', 'RESOLVED'];
const statusLabels: Record<FilterState['status'], string> = {
  ALL: 'Все',
  OPEN: 'Активные',
  RESOLVED: 'Решённые',
};

const radiusOptions = [1, 5, 10, 25, 50];

interface FiltersProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
}

const Pill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
      active
        ? 'bg-coral-500 text-white shadow-sm shadow-coral-200'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`}
  >
    {children}
  </button>
);

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{label}</p>
    {children}
  </div>
);

const Filters: React.FC<FiltersProps> = ({ value, onChange, onReset }) => {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });
  const active = countActiveFilters(value);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-coral-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
            />
          </svg>
          Фильтры
        </h3>
        {active > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-sm text-gray-500 hover:text-coral-600 font-medium flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Сбросить ({active})
          </button>
        )}
      </div>

      {/* Animal type */}
      <Section label="Тип животного">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(animalLabels) as (AnimalType | 'ALL')[]).map(a => (
            <Pill key={a} active={value.animalType === a} onClick={() => set({ animalType: a })}>
              {animalLabels[a]}
            </Pill>
          ))}
        </div>
      </Section>

      {/* Date range */}
      <Section label="Дата публикации">
        <div className="flex flex-wrap gap-2">
          {datePresets.map(p => (
            <Pill key={p} active={value.datePreset === p} onClick={() => set({ datePreset: p })}>
              {dateLabels[p]}
            </Pill>
          ))}
        </div>
        {value.datePreset === 'custom' && (
          <input
            type="date"
            value={value.customDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => set({ customDate: e.target.value })}
            className="mt-3 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-coral-500 focus:border-transparent"
          />
        )}
      </Section>

      {/* Location */}
      <Section label="Местоположение">
        <div className="flex flex-col sm:flex-row gap-2">
          <AddressAutocomplete
            value={value.location}
            onChange={v => set({ location: v, lat: undefined, lon: undefined })}
            onSelect={(address, lat, lon) => set({ location: address, lat, lon })}
            placeholder="Город, район или улица"
            wrapperClassName="relative flex-1"
            className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-coral-500 focus:border-transparent"
          />
          <select
            value={String(value.radiusKm)}
            onChange={e =>
              set({ radiusKm: e.target.value === 'ANY' ? 'ANY' : Number(e.target.value) })
            }
            disabled={value.lat === undefined}
            title={
              value.lat === undefined
                ? 'Выберите адрес из подсказок, чтобы искать по радиусу'
                : undefined
            }
            className="border border-gray-200 rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-coral-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="ANY">По названию</option>
            {radiusOptions.map(r => (
              <option key={r} value={r}>
                В радиусе {r} км
              </option>
            ))}
          </select>
        </div>
        {value.location.trim() && value.lat === undefined && (
          <p className="text-xs text-gray-400 mt-1.5">
            Выберите адрес из подсказок, чтобы искать по радиусу вокруг точки.
          </p>
        )}
      </Section>

      {/* Status */}
      <Section label="Статус">
        <div className="flex flex-wrap gap-2">
          {statuses.map(s => (
            <Pill key={s} active={value.status === s} onClick={() => set({ status: s })}>
              {statusLabels[s]}
            </Pill>
          ))}
        </div>
      </Section>
    </div>
  );
};

export default Filters;
