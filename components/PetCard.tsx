import React from 'react';
import { PetPost, PostType } from '../types';

interface PetCardProps {
  post: PetPost;
  onClick?: () => void;
}

const PetCard: React.FC<PetCardProps> = ({ post, onClick }) => {
  const isLost = post.type === PostType.LOST;

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-100 cursor-pointer flex flex-col h-full"
    >
      <div className="relative h-48 w-full bg-gray-200">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={post.title} className={`w-full h-full object-cover ${post.status === 'RESOLVED' ? 'opacity-75' : ''}`} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Нет фото
          </div>
        )}
        <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider ${isLost ? 'bg-red-500' : 'bg-green-500'}`}>
          {isLost ? 'ПРОПАЛ' : 'НАЙДЕН'}
        </div>
        {post.status === 'RESOLVED' && (
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <span className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              ЗАВЕРШЕНО
            </span>
          </div>
        )}
      </div>
      
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg text-gray-800 line-clamp-1">{post.title}</h3>
        </div>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-2 flex-grow">{post.description}</p>
        
        <div className="space-y-2 mt-auto">
            {post.reward && (
                <div className="flex items-center text-amber-600 text-sm font-semibold bg-amber-50 p-2 rounded">
                    <span className="mr-2">🏆</span> Вознаграждение: {post.reward}
                </div>
            )}
            
            <div className="flex items-center text-gray-500 text-xs">
                <span className="mr-2">📍</span> {post.location}
            </div>
            <div className="flex items-center text-gray-500 text-xs">
                 <span className="mr-2">🕒</span> {new Date(post.createdAt || post.created_at || Date.now()).toLocaleDateString()}
            </div>
        </div>
      </div>
    </div>
  );
};

export default PetCard;