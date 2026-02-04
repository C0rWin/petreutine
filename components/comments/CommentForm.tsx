import React, { useState } from 'react';

interface CommentFormProps {
  postId: string;
  parentId?: string | null;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  submitLabel?: string;
  isReply?: boolean;
  isAuthenticated: boolean;
  onLoginClick?: () => void;
}

export const CommentForm: React.FC<CommentFormProps> = ({
  onSubmit,
  onCancel,
  placeholder = 'Напишите комментарий...',
  submitLabel = 'Отправить',
  isReply = false,
  isAuthenticated,
  onLoginClick,
}) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError('Комментарий не может быть пустым');
      return;
    }

    if (content.length > 2000) {
      setError('Комментарий слишком длинный (максимум 2000 символов)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(content.trim());
      setContent('');
      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить комментарий');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${isReply ? 'ml-8' : ''}`}>
        <p className="text-gray-600 text-sm">
          Чтобы оставить комментарий, необходимо{' '}
          <button
            onClick={onLoginClick}
            className="text-coral-600 hover:text-coral-700 font-medium"
          >
            войти в аккаунт
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={isReply ? 'ml-8 mt-2' : ''}>
      <div className="relative">
        <textarea
          value={content}
          onChange={e => {
            setContent(e.target.value);
            setError(null);
          }}
          placeholder={placeholder}
          disabled={isSubmitting}
          className={`w-full px-4 py-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-coral-500/50 focus:border-coral-500 transition-colors ${
            error ? 'border-red-300' : 'border-gray-200'
          } ${isReply ? 'min-h-[80px]' : 'min-h-[100px]'}`}
          rows={isReply ? 2 : 3}
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">{content.length}/2000</div>
      </div>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      <div className="mt-2 flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Отмена
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="px-4 py-2 bg-coral-500 text-white text-sm font-medium rounded-lg hover:bg-coral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

export default CommentForm;
