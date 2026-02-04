import React from 'react';

import { Notification, NotificationType } from '../../types';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'только что';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} мин`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ч`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} д`;
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

function getNotificationIcon(type: NotificationType): React.ReactNode {
  switch (type) {
    case NotificationType.COMMENT_REPLY:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
      );
    case NotificationType.POST_COMMENT:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      );
    case NotificationType.COMMENT_UPVOTE:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    case NotificationType.MODERATION_APPROVED:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case NotificationType.MODERATION_REJECTED:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      );
  }
}

function getIconBackground(type: NotificationType): string {
  switch (type) {
    case NotificationType.COMMENT_REPLY:
      return 'bg-teal-100 text-teal-600';
    case NotificationType.POST_COMMENT:
      return 'bg-blue-100 text-blue-600';
    case NotificationType.COMMENT_UPVOTE:
      return 'bg-coral-100 text-coral-600';
    case NotificationType.MODERATION_APPROVED:
      return 'bg-green-100 text-green-600';
    case NotificationType.MODERATION_REJECTED:
      return 'bg-red-100 text-red-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
        !notification.is_read ? 'bg-coral-50/30' : ''
      }`}
    >
      {/* Icon */}
      <div className={`p-2 rounded-full ${getIconBackground(notification.type)}`}>
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${!notification.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}
        >
          {notification.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(notification.created_at)}</p>
      </div>

      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="w-2 h-2 rounded-full bg-coral-500 mt-2 flex-shrink-0" />
      )}
    </button>
  );
};

export default NotificationItem;
