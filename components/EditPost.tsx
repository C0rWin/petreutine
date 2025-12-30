import React, { useState } from 'react';
import { AnimalType, PostType, PetPost } from '../types';
import { api } from '../services/api';
import YandexMap from './YandexMap';

interface EditPostProps {
  post: PetPost;
  onClose: () => void;
  onSuccess: (updatedPost: PetPost) => void;
}

const animalTypeLabels: Record<AnimalType, string> = {
  [AnimalType.DOG]: 'Собака',
  [AnimalType.CAT]: 'Кошка',
  [AnimalType.BIRD]: 'Птица',
  [AnimalType.OTHER]: 'Другое',
};

const EditPost: React.FC<EditPostProps> = ({ post, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<Partial<PetPost> & { latitude?: number; longitude?: number }>({
    type: post.type,
    animalType: post.animalType || post.animal_type,
    title: post.title,
    description: post.description,
    location: post.location,
    latitude: post.latitude,
    longitude: post.longitude,
    reward: post.reward || '',
    contactInfo: post.contactInfo || post.contact_info || '',
    imageUrl: post.imageUrl || post.image_url || '',
    status: post.status,
  });
  const [showMap, setShowMap] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Размер файла не должен превышать 5 МБ');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.updatePost(post.id, {
        type: formData.type as PostType,
        animalType: formData.animalType as AnimalType,
        title: formData.title,
        description: formData.description,
        location: formData.location,
        contactInfo: formData.contactInfo,
        reward: formData.reward,
        imageUrl: formData.imageUrl,
        status: formData.status as 'OPEN' | 'RESOLVED',
      });

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.data) {
        onSuccess(response.data);
      }
    } catch (err) {
      setError('Не удалось обновить объявление. Попробуйте ещё раз.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Редактировать объявление</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Status Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Статус объявления</label>
              <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
                <button
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, status: 'OPEN'}))}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${formData.status === 'OPEN' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Активно
                </button>
                <button
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, status: 'RESOLVED'}))}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${formData.status === 'RESOLVED' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Питомец найден
                </button>
              </div>
              {formData.status === 'RESOLVED' && (
                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Объявление будет помечено как завершённое
                </p>
              )}
            </div>

            {/* Type Selection */}
            <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
                <button
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, type: PostType.LOST}))}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${formData.type === PostType.LOST ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Пропал питомец
                </button>
                <button
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, type: PostType.FOUND}))}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${formData.type === PostType.FOUND ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Найден питомец
                </button>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип животного</label>
                <select
                    name="animalType"
                    value={formData.animalType}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {Object.values(AnimalType).map(t => <option key={t} value={t}>{animalTypeLabels[t]}</option>)}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок</label>
                <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                />
            </div>

            <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">Местоположение</label>
                    <button
                        type="button"
                        onClick={() => setShowMap(!showMap)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {showMap ? 'Скрыть карту' : 'Изменить на карте'}
                    </button>
                </div>
                {showMap ? (
                    <YandexMap
                        onLocationSelect={(location, lat, lon) => {
                            setFormData(prev => ({
                                ...prev,
                                location,
                                latitude: lat,
                                longitude: lon,
                            }));
                        }}
                        initialLocation={formData.location}
                        initialLatitude={formData.latitude}
                        initialLongitude={formData.longitude}
                    />
                ) : (
                    <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Вознаграждение (необязательно)</label>
                <input
                    type="text"
                    name="reward"
                    value={formData.reward}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Контактная информация</label>
                <input
                    type="text"
                    name="contactInfo"
                    value={formData.contactInfo}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Фото</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors cursor-pointer relative">
                    <div className="space-y-1 text-center">
                        {formData.imageUrl ? (
                            <div className="relative">
                                <img src={formData.imageUrl} alt="Preview" className="mx-auto h-48 object-contain" />
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                                    className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ) : (
                            <>
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div className="flex text-sm text-gray-600 justify-center">
                                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                                        <span>Загрузить файл</span>
                                        <input type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500">PNG, JPG до 5 МБ</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Отмена</button>
            <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {isSubmitting ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Сохранение...
                    </>
                ) : 'Сохранить'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default EditPost;
