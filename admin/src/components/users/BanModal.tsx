import React, { useEffect, useState } from 'react';

import { BanType } from '../../types';

interface BanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { ban_type: BanType; reason: string; duration_hours?: number }) => Promise<void>;
  userName: string;
  isLoading?: boolean;
}

const durationPresets = [
  { label: '1 час', hours: 1 },
  { label: '24 часа', hours: 24 },
  { label: '7 дней', hours: 24 * 7 },
  { label: '30 дней', hours: 24 * 30 },
  { label: 'Навсегда', hours: 0 },
];

export function BanModal({ isOpen, onClose, onSubmit, userName, isLoading }: BanModalProps) {
  const [banType, setBanType] = useState<BanType>('full');
  const [reason, setReason] = useState('');
  const [durationHours, setDurationHours] = useState<number | undefined>(undefined);
  const [customDuration, setCustomDuration] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBanType('full');
      setReason('');
      setDurationHours(undefined);
      setCustomDuration('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError('Укажите причину бана');
      return;
    }

    try {
      await onSubmit({
        ban_type: banType,
        reason: reason.trim(),
        duration_hours: durationHours || undefined,
      });
      onClose();
    } catch {
      setError('Не удалось заблокировать пользователя');
    }
  };

  const handleDurationSelect = (hours: number) => {
    if (hours === 0) {
      setDurationHours(undefined);
      setCustomDuration('');
    } else {
      setDurationHours(hours);
      setCustomDuration('');
    }
  };

  const handleCustomDurationChange = (value: string) => {
    setCustomDuration(value);
    const hours = parseInt(value, 10);
    if (!isNaN(hours) && hours > 0) {
      setDurationHours(hours);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Заблокировать пользователя</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Вы собираетесь заблокировать пользователя <strong>{userName}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          {/* Ban Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Тип блокировки</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setBanType('full')}
                className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                  banType === 'full'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900">Полный бан</p>
                <p className="text-xs text-gray-500 mt-1">Пользователь не сможет войти в систему</p>
              </button>
              <button
                type="button"
                onClick={() => setBanType('comment')}
                className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                  banType === 'comment'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900">Бан комментариев</p>
                <p className="text-xs text-gray-500 mt-1">Пользователь не сможет комментировать</p>
              </button>
            </div>
          </div>

          {/* Duration */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Длительность</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {durationPresets.map(preset => (
                <button
                  key={preset.hours}
                  type="button"
                  onClick={() => handleDurationSelect(preset.hours)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    (preset.hours === 0 && durationHours === undefined) ||
                    (preset.hours !== 0 && durationHours === preset.hours && !customDuration)
                      ? 'bg-coral-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={customDuration}
                onChange={e => handleCustomDurationChange(e.target.value)}
                placeholder="Другое количество часов"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral-500"
              />
              <span className="text-sm text-gray-500">часов</span>
            </div>
          </div>

          {/* Reason */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Причина блокировки <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Опишите причину блокировки..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral-500 resize-none"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Блокировка...' : 'Заблокировать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
