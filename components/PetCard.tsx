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
          <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Нет фото
          </div>
        )}
        <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider ${isLost ? 'bg-red-500' : 'bg-green-500'}`}>
          {isLost ? 'ПРОПАЛ' : 'НАЙДЕН'}
        </div>
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