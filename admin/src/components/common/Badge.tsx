import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'gray';
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

const variantStyles = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-700',
};

const sizeStyles = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

export function Badge({ variant = 'gray', children, size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
}

// Helper function to get badge variant for common statuses
export function getBanStatusBadge(banType: string | null) {
  if (!banType) {
    return <Badge variant="success">Активен</Badge>;
  }
  if (banType === 'full') {
    return <Badge variant="danger">Заблокирован</Badge>;
  }
  if (banType === 'comment') {
    return <Badge variant="warning">Бан комментариев</Badge>;
  }
  return <Badge variant="gray">{banType}</Badge>;
}

export function getPostStatusBadge(status: string) {
  if (status === 'OPEN') {
    return <Badge variant="info">Открыт</Badge>;
  }
  if (status === 'RESOLVED') {
    return <Badge variant="success">Завершен</Badge>;
  }
  return <Badge variant="gray">{status}</Badge>;
}

export function getPostTypeBadge(type: string) {
  if (type === 'LOST') {
    return <Badge variant="danger">Потерян</Badge>;
  }
  if (type === 'FOUND') {
    return <Badge variant="success">Найден</Badge>;
  }
  return <Badge variant="gray">{type}</Badge>;
}

export function getCommentStatusBadge(status: string) {
  switch (status) {
    case 'approved':
      return <Badge variant="success">Одобрен</Badge>;
    case 'pending':
      return <Badge variant="warning">На модерации</Badge>;
    case 'rejected':
      return <Badge variant="danger">Отклонен</Badge>;
    case 'flagged':
      return <Badge variant="danger">Жалоба</Badge>;
    default:
      return <Badge variant="gray">{status}</Badge>;
  }
}
