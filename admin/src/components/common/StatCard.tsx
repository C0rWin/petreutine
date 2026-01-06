import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'coral' | 'teal' | 'warm' | 'gray';
  subtitle?: string;
}

const variantStyles = {
  coral: {
    bg: 'bg-coral-50',
    icon: 'bg-coral-100 text-coral-600',
    trend: 'text-coral-600',
  },
  teal: {
    bg: 'bg-teal-50',
    icon: 'bg-teal-100 text-teal-600',
    trend: 'text-teal-600',
  },
  warm: {
    bg: 'bg-warm-50',
    icon: 'bg-warm-100 text-warm-600',
    trend: 'text-warm-600',
  },
  gray: {
    bg: 'bg-gray-50',
    icon: 'bg-gray-100 text-gray-600',
    trend: 'text-gray-600',
  },
};

export function StatCard({
  title,
  value,
  icon,
  trend,
  variant = 'gray',
  subtitle,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <svg
                className={`w-4 h-4 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={trend.isPositive ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}
                />
              </svg>
              <span className={`text-sm font-medium ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-3 rounded-xl ${styles.icon}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
