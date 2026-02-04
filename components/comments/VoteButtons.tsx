import React from 'react';

import { VoteType } from '../../types';

interface VoteButtonsProps {
  upvotes: number;
  downvotes: number;
  score: number;
  currentVote: VoteType | null | undefined;
  onVote: (voteType: VoteType) => void;
  onRemoveVote: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export const VoteButtons: React.FC<VoteButtonsProps> = ({
  score,
  currentVote,
  onVote,
  onRemoveVote,
  disabled = false,
  compact = false,
}) => {
  const handleUpvote = () => {
    if (disabled) return;
    if (currentVote === VoteType.UPVOTE) {
      onRemoveVote();
    } else {
      onVote(VoteType.UPVOTE);
    }
  };

  const handleDownvote = () => {
    if (disabled) return;
    if (currentVote === VoteType.DOWNVOTE) {
      onRemoveVote();
    } else {
      onVote(VoteType.DOWNVOTE);
    }
  };

  const buttonClass = compact
    ? 'p-1 rounded transition-colors'
    : 'p-1.5 rounded-lg transition-colors';

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleUpvote}
        disabled={disabled}
        className={`${buttonClass} ${
          currentVote === VoteType.UPVOTE
            ? 'text-coral-500 bg-coral-50'
            : 'text-gray-400 hover:text-coral-500 hover:bg-coral-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Полезно"
        aria-label="Голос за"
      >
        <svg
          className={compact ? 'w-4 h-4' : 'w-5 h-5'}
          fill={currentVote === VoteType.UPVOTE ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      <span
        className={`font-medium min-w-[2rem] text-center ${
          score > 0 ? 'text-coral-600' : score < 0 ? 'text-teal-600' : 'text-gray-500'
        } ${compact ? 'text-xs' : 'text-sm'}`}
      >
        {score}
      </span>

      <button
        onClick={handleDownvote}
        disabled={disabled}
        className={`${buttonClass} ${
          currentVote === VoteType.DOWNVOTE
            ? 'text-teal-500 bg-teal-50'
            : 'text-gray-400 hover:text-teal-500 hover:bg-teal-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Не полезно"
        aria-label="Голос против"
      >
        <svg
          className={compact ? 'w-4 h-4' : 'w-5 h-5'}
          fill={currentVote === VoteType.DOWNVOTE ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
};

export default VoteButtons;
