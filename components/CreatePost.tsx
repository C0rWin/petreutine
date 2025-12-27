import React, { useState, useEffect, useCallback } from 'react';
import { AnimalType, PostType, PetPost, GeminiMatchResult } from '../types';
import { geminiService } from '../services/geminiService';
import { db } from '../services/mockDb';

interface CreatePostProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<PetPost>>({
    type: PostType.LOST,
    animalType: AnimalType.DOG,
    title: '',
    description: '',
    location: '',
    reward: '',
    contactInfo: '',
    imageUrl: '',
  });
  
  const [matches, setMatches] = useState<GeminiMatchResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [matchedPosts, setMatchedPosts] = useState<PetPost[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced check for matches
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.description && formData.description.length > 10 && formData.type) {
        setIsChecking(true);
        try {
          const allPosts = db.getPosts();
          const results = await geminiService.findPotentialMatches(formData, allPosts);
          setMatches(results);
          
          // Hydrate the matches with full post data
          const relevantPosts = allPosts.filter(p => results.some(r => r.postId === p.id));
          setMatchedPosts(relevantPosts);
        } catch (e) {
          console.error(e);
        } finally {
          setIsChecking(false);
        }
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [formData.description, formData.type, formData.animalType, formData.location]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate backend delay
    setTimeout(() => {
        const user = db.getCurrentUser();
        if (!user) return; // Should be logged in

        const newPost: PetPost = {
            id: Math.random().toString(36).substr(2, 9),
            userId: user.id,
            user: user,
            type: formData.type as PostType,
            animalType: formData.animalType as AnimalType,
            status: 'OPEN',
            title: formData.title || `${formData.type} ${formData.animalType}`,
            description: formData.description || '',
            location: formData.location || '',
            contactInfo: formData.contactInfo || '',
            reward: formData.reward,
            imageUrl: formData.imageUrl,
            createdAt: Date.now(),
        };

        db.addPost(newPost);
        setIsSubmitting(false);
        onSuccess();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex overflow-hidden shadow-2xl">
        
        {/* Left Side: Form */}
        <div className="w-full md:w-1/2 p-8 overflow-y-auto border-r border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Create New Post</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Type Selection */}
            <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
                <button
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, type: PostType.LOST}))}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${formData.type === PostType.LOST ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Lost Pet
                </button>
                <button
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, type: PostType.FOUND}))}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${formData.type === PostType.FOUND ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Found Pet
                </button>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Animal Type</label>
                <select 
                    name="animalType" 
                    value={formData.animalType} 
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {Object.values(AnimalType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input 
                    type="text" 
                    name="title" 
                    value={formData.title} 
                    onChange={handleInputChange}
                    placeholder={`e.g., ${formData.type === PostType.LOST ? 'Lost Golden Retriever' : 'Found Small Kitten'}`}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                    name="description" 
                    value={formData.description} 
                    onChange={handleInputChange}
                    placeholder="Describe specific features, collar, behavior..."
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                />
                <p className="text-xs text-gray-500 mt-1">Detailed descriptions help our AI find matches.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input 
                        type="text" 
                        name="location" 
                        value={formData.location} 
                        onChange={handleInputChange}
                        placeholder="City, Neighborhood, or Zip"
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reward (Optional)</label>
                    <input 
                        type="text" 
                        name="reward" 
                        value={formData.reward} 
                        onChange={handleInputChange}
                        placeholder="$ Amount"
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Info</label>
                <input 
                    type="text" 
                    name="contactInfo" 
                    value={formData.contactInfo} 
                    onChange={handleInputChange}
                    placeholder="Phone or Email"
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors cursor-pointer relative">
                    <div className="space-y-1 text-center">
                        {formData.imageUrl ? (
                            <img src={formData.imageUrl} alt="Preview" className="mx-auto h-48 object-contain" />
                        ) : (
                            <>
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div className="flex text-sm text-gray-600 justify-center">
                                    <span className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                        <span>Upload a file</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSubmitting ? 'Publishing...' : 'Publish Post'}
                </button>
            </div>

          </form>
        </div>

        {/* Right Side: AI Suggestions */}
        <div className="hidden md:flex md:w-1/2 bg-blue-50 flex-col p-8 border-l border-blue-100">
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-blue-600 rounded-lg">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">AI Match Detection</h3>
                </div>
                <p className="text-sm text-gray-600">
                    As you type, Gemini checks existing {formData.type === PostType.LOST ? 'Found' : 'Lost'} reports to see if your pet has already been reported.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
                {isChecking && (
                    <div className="flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-blue-600 font-medium">Analyzing potential matches...</span>
                    </div>
                )}

                {!isChecking && matchedPosts.length === 0 && formData.description?.length > 10 && (
                     <div className="text-center py-10 text-gray-400">
                        <p>No matches found yet.</p>
                        <p className="text-sm">We'll notify you if we find something later.</p>
                     </div>
                )}

                {!isChecking && matchedPosts.length === 0 && (!formData.description || formData.description.length <= 10) && (
                    <div className="text-center py-10 text-gray-400">
                        <p>Start describing your pet to see matches.</p>
                    </div>
                )}

                <div className="space-y-4">
                    {matchedPosts.map(post => {
                        const matchInfo = matches.find(m => m.postId === post.id);
                        return (
                            <div key={post.id} className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 hover:shadow-md transition-all">
                                <div className="flex gap-4">
                                    <img 
                                        src={post.imageUrl || 'https://via.placeholder.com/100'} 
                                        alt={post.title} 
                                        className="w-20 h-20 rounded-lg object-cover bg-gray-100"
                                    />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-gray-900">{post.title}</h4>
                                            {matchInfo && (
                                                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-medium">
                                                    {(matchInfo.confidence * 100).toFixed(0)}% Match
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{post.description}</p>
                                        <div className="mt-2 text-xs text-gray-500 flex items-center gap-3">
                                            <span>📍 {post.location}</span>
                                            <span className="text-blue-600 font-medium">View Details</span>
                                        </div>
                                    </div>
                                </div>
                                {matchInfo && (
                                    <div className="mt-3 text-xs bg-blue-50 p-2 rounded border border-blue-100 text-blue-800">
                                        <strong>AI Insight:</strong> {matchInfo.reason}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default CreatePost;