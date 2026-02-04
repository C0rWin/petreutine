import React from 'react';

import { PetPost, PostType } from '../types';

interface PetCardProps {
  post: PetPost;
  onClick?: () => void;
}

// Time-ago formatting utility
const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} ${pluralize(diffMins, 'минуту', 'минуты', 'минут')} назад`;
  if (diffHours < 24) return `${diffHours} ${pluralize(diffHours, 'час', 'часа', 'часов')} назад`;
  if (diffDays < 7) return `${diffDays} ${pluralize(diffDays, 'день', 'дня', 'дней')} назад`;

  return date.toLocaleDateString('ru-RU');
};

// Russian pluralization helper
const pluralize = (n: number, one: string, few: string, many: string): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
};

// Check if post is urgent (less than 24 hours old and LOST)
const isUrgent = (post: PetPost): boolean => {
  const timestamp =
    post.createdAt || (post.created_at ? new Date(post.created_at).getTime() : Date.now());
  const postDate = new Date(timestamp);
  const now = new Date();
  const hoursDiff = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);

  return post.type === PostType.LOST && hoursDiff < 24 && post.status !== 'RESOLVED';
};

const PetCard: React.FC<PetCardProps> = ({ post, onClick }) => {
  const isLost = post.type === PostType.LOST;
  const urgent = isUrgent(post);
  const timestamp =
    post.createdAt || (post.created_at ? new Date(post.created_at).getTime() : Date.now());
  const postDate = new Date(timestamp);
  const timeAgo = getTimeAgo(postDate);

  return (
    <div
      onClick={onClick}
      className="card-hover bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 cursor-pointer flex flex-col h-full group"
    >
      {/* Image Container with Gradient Overlay */}
      <div className="relative h-52 w-full bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt={post.title}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${post.status === 'RESOLVED' ? 'opacity-75' : ''}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg
              className="w-16 h-16 mb-2 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm">Нет фото</span>
          </div>
        )}

        {/* Gradient overlay for better text readability */}
        {post.imageUrl && (
          <div className="absolute inset-0 gradient-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}

        {/* Status Badge */}
        <div
          className={`absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold text-white uppercase tracking-wider shadow-lg ${isLost ? 'bg-coral-500' : 'bg-teal-400'}`}
        >
          {isLost ? 'ПРОПАЛ' : 'НАЙДЕН'}
        </div>

        {/* Urgent Badge */}
        {urgent && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold text-white uppercase bg-red-600 animate-pulse-urgent flex items-center gap-1 shadow-lg">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            СРОЧНО
          </div>
        )}

        {/* Resolved Overlay */}
        {post.status === 'RESOLVED' && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center backdrop-blur-sm">
            <span className="bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-xl">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              ДОМА!
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="font-bold text-lg text-gray-800 line-clamp-1 mb-2 group-hover:text-coral-600 transition-colors">
          {post.title}
        </h3>

        <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-grow leading-relaxed">
          {post.description}
        </p>

        <div className="space-y-2.5 mt-auto">
          {/* Reward Badge */}
          {post.reward && (
            <div className="flex items-center text-warm-500 text-sm font-semibold bg-warm-50 p-2.5 rounded-xl border border-warm-200">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Вознаграждение: {post.reward}
            </div>
          )}

          {/* Location */}
          <div className="flex items-center text-gray-500 text-sm">
            <svg
              className="w-4 h-4 mr-2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="truncate">{post.location}</span>
          </div>

          {/* Time */}
          <div className="flex items-center text-gray-400 text-xs">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className={urgent ? 'text-red-500 font-medium' : ''}>{timeAgo}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PetCard;
