import React, { useCallback, useEffect, useState } from 'react';

import { api } from '../../services/api';
import { Notification } from '../../types';
import { NotificationDropdown } from './NotificationDropdown';

interface NotificationBadgeProps {
  onNotificationClick?: (notification: Notification) => void;
}

const POLL_INTERVAL = 30000; // 30 seconds

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ onNotificationClick }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    const result = await api.getUnreadCount();
    if (!result.error && result.data) {
      setUnreadCount(result.data.count);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchUnreadCount();

    // Poll for updates
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleDropdownClose = () => {
    setIsDropdownOpen(false);
    // Refresh count when dropdown closes
    fetchUnreadCount();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="relative p-2 text-white/80 hover:text-white transition-colors"
        aria-label="Уведомления"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-coral-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationDropdown
        isOpen={isDropdownOpen}
        onClose={handleDropdownClose}
        onNotificationClick={onNotificationClick}
      />
    </div>
  );
};

export default NotificationBadge;
