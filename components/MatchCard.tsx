import React from 'react';

import { PetPost, PostType } from '../types';

interface MatchCardProps {
  match: PetPost & { confidence: number; reason: string };
  onClick: () => void;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, onClick }) => {
  const confidencePercent = Math.round(match.confidence * 100);

  // Color based on confidence level
  const getConfidenceColor = () => {
    if (confidencePercent >= 70) return 'bg-teal-500';
    if (confidencePercent >= 40) return 'bg-warm-400';
    return 'bg-gray-400';
  };

  const getConfidenceTextColor = () => {
    if (confidencePercent >= 70) return 'text-teal-700';
    if (confidencePercent >= 40) return 'text-warm-500';
    return 'text-gray-600';
  };

  const getConfidenceBgColor = () => {
    if (confidencePercent >= 70) return 'bg-teal-50';
    if (confidencePercent >= 40) return 'bg-warm-50';
    return 'bg-gray-50';
  };

  return (
    <div
      onClick={onClick}
      className="flex gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-coral-200 hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        {match.imageUrl || match.image_url ? (
          <img
            src={match.imageUrl || match.image_url}
            alt={match.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase text-white ${match.type === PostType.LOST ? 'bg-coral-500' : 'bg-teal-500'}`}
          >
            {match.type === PostType.LOST ? 'Пропал' : 'Найден'}
          </span>
          <h4 className="font-semibold text-sm text-gray-900 truncate group-hover:text-coral-600 transition-colors">
            {match.title}
          </h4>
        </div>

        <p className="text-xs text-gray-500 truncate mb-2 flex items-center gap-1">
          <svg
            className="w-3 h-3 flex-shrink-0"
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
          </svg>
          {match.location}
        </p>

        {/* Confidence & Reason */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${getConfidenceBgColor()}`}
        >
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${getConfidenceColor()}`} />
            <span className={`text-xs font-bold ${getConfidenceTextColor()}`}>
              {confidencePercent}%
            </span>
          </div>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-600 truncate">{match.reason}</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex-shrink-0 flex items-center text-gray-300 group-hover:text-coral-500 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
};

export default MatchCard;
