import React, { useState } from 'react';

import { ReportReason } from '../../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, description?: string) => Promise<void>;
}

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  {
    value: ReportReason.SPAM,
    label: 'Спам',
    description: 'Реклама, повторяющийся контент',
  },
  {
    value: ReportReason.HARASSMENT,
    label: 'Оскорбления',
    description: 'Угрозы, травля, ненависть',
  },
  {
    value: ReportReason.OFF_TOPIC,
    label: 'Не по теме',
    description: 'Не связано с поиском питомцев',
  },
  {
    value: ReportReason.MISINFORMATION,
    label: 'Ложная информация',
    description: 'Заведомо неверные сведения',
  },
  {
    value: ReportReason.OTHER,
    label: 'Другое',
    description: 'Иная причина',
  },
];

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedReason) {
      setError('Выберите причину жалобы');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(selectedReason, description.trim() || undefined);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить жалобу');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full animate-fade-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Пожаловаться на комментарий</h3>
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
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

          <form onSubmit={handleSubmit}>
            <div className="space-y-2 mb-4">
              {REPORT_REASONS.map(reason => (
                <label
                  key={reason.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedReason === reason.value
                      ? 'border-coral-500 bg-coral-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={() => setSelectedReason(reason.value)}
                    className="mt-0.5 text-coral-500 focus:ring-coral-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">{reason.label}</span>
                    <p className="text-sm text-gray-500">{reason.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {selectedReason && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дополнительное описание (необязательно)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Опишите проблему подробнее..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-coral-500/50 focus:border-coral-500"
                  rows={3}
                  maxLength={500}
                />
                <div className="text-xs text-gray-400 text-right mt-1">
                  {description.length}/500
                </div>
              </div>
            )}

            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedReason}
                className="px-4 py-2 bg-coral-500 text-white font-medium rounded-lg hover:bg-coral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                Отправить жалобу
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
