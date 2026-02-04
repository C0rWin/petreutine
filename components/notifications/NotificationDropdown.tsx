import React, { useEffect, useRef, useState } from 'react';

import { api } from '../../services/api';
import { Notification } from '../../types';
import { NotificationItem } from './NotificationItem';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  onNotificationClick,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const loadNotifications = async () => {
    setIsLoading(true);
    setError(null);

    const result = await api.getNotifications({ limit: 20 });

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setNotifications(result.data.notifications);
    }

    setIsLoading(false);
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await api.markNotificationRead(notification.id);
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    }

    onNotificationClick?.(notification);
    onClose();
  };

  const handleMarkAllRead = async () => {
    const result = await api.markAllNotificationsRead();
    if (!result.error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fade-in"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Уведомления</h3>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-coral-600 hover:text-coral-700 font-medium"
          >
            Прочитать все
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-5 w-5 text-coral-500" viewBox="0 0 24 24">
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
          </div>
        ) : error ? (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={loadNotifications}
              className="text-sm text-coral-600 hover:text-coral-700 mt-2"
            >
              Попробовать снова
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 px-4">
            <svg
              className="w-10 h-10 mx-auto text-gray-300 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-sm text-gray-500">Нет уведомлений</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
