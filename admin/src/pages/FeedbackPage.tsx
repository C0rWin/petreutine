import React, { useCallback, useEffect, useState } from 'react';

import { adminApi } from '../services/api';
import { Feedback } from '../types';

export function FeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await adminApi.getFeedback({ limit: 100 });
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setItems(res.data.feedback);
      setUnread(res.data.unread);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await adminApi.markFeedbackRead(id);
    setItems(prev => prev.map(f => (f.id === id ? { ...f, is_read: true } : f)));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const remove = async (id: string) => {
    const target = items.find(f => f.id === id);
    await adminApi.deleteFeedback(id);
    setItems(prev => prev.filter(f => f.id !== id));
    setTotal(prev => Math.max(0, prev - 1));
    if (target && !target.is_read) setUnread(prev => Math.max(0, prev - 1));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Обратная связь</h1>
        <p className="text-gray-500 mt-1">
          Сообщения с сайта — всего {total}
          {unread > 0 && <span className="text-coral-600 font-medium">, новых {unread}</span>}
        </p>
      </div>

      {loading ? (
        <div className="text-gray-500">Загрузка…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{error}</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
          Пока нет сообщений.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(f => (
            <div
              key={f.id}
              className={`bg-white border rounded-xl p-4 ${
                f.is_read ? 'border-gray-200' : 'border-coral-300 ring-1 ring-coral-100'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!f.is_read && (
                      <span className="inline-block w-2 h-2 rounded-full bg-coral-500" />
                    )}
                    <span className="font-medium text-gray-900">{f.name || 'Аноним'}</span>
                    {f.email && (
                      <a
                        href={`mailto:${f.email}`}
                        className="text-sm text-coral-600 hover:underline"
                      >
                        {f.email}
                      </a>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(f.created_at)}</span>
                  </div>
                  <p className="text-gray-700 mt-2 whitespace-pre-wrap break-words">{f.message}</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {!f.is_read && (
                    <button
                      onClick={() => markRead(f.id)}
                      className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Прочитано
                    </button>
                  )}
                  <button
                    onClick={() => remove(f.id)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
