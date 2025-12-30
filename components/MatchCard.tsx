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
    if (confidencePercent >= 70) return 'bg-green-500';
    if (confidencePercent >= 40) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const getConfidenceTextColor = () => {
    if (confidencePercent >= 70) return 'text-green-700';
    if (confidencePercent >= 40) return 'text-yellow-700';
    return 'text-gray-600';
  };

  return (
    <div
      onClick={onClick}
      className="flex gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
        {(match.imageUrl || match.image_url) ? (
          <img
            src={match.imageUrl || match.image_url}
            alt={match.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            Нет фото
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white ${match.type === PostType.LOST ? 'bg-red-500' : 'bg-green-500'}`}>
            {match.type === PostType.LOST ? 'Пропал' : 'Найден'}
          </span>
          <h4 className="font-medium text-sm text-gray-900 truncate">{match.title}</h4>
        </div>

        <p className="text-xs text-gray-500 truncate mb-1.5">{match.location}</p>

        {/* Confidence & Reason */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${getConfidenceColor()}`} />
            <span className={`text-xs font-medium ${getConfidenceTextColor()}`}>
              {confidencePercent}%
            </span>
          </div>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500 truncate">{match.reason}</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex-shrink-0 flex items-center text-gray-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
};

export default MatchCard;
