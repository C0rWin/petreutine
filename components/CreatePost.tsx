import React, { useState } from 'react';
import { AnimalType, PostType, PetPost } from '../types';
import { api } from '../services/api';
import YandexMap from './YandexMap';

interface CreatePostProps {
  onClose: () => void;
  onSuccess: () => void;
}

const animalTypeLabels: Record<AnimalType, string> = {
  [AnimalType.DOG]: 'Собака',
  [AnimalType.CAT]: 'Кошка',
  [AnimalType.BIRD]: 'Птица',
  [AnimalType.OTHER]: 'Другое',
};

const CreatePost: React.FC<CreatePostProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState<Partial<PetPost> & { latitude?: number; longitude?: number }>({
    type: PostType.LOST,
    animalType: AnimalType.DOG,
    title: '',
    description: '',
    location: '',
    latitude: undefined,
    longitude: undefined,
    reward: '',
    contactInfo: '',
    imageUrl: '',
  });
  const [showMap, setShowMap] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Размер файла не должен превышать 10 МБ');
        return;
      }

      // Show local preview immediately
      const localPreview = URL.createObjectURL(file);
      setImagePreview(localPreview);
      setIsUploading(true);
      setError(null);

      try {
        const response = await api.uploadImage(file);
        if (response.error) {
          setError(response.error);
          setImagePreview(null);
          URL.revokeObjectURL(localPreview);
          return;
        }

        if (response.data) {
          setFormData(prev => ({ ...prev, imageUrl: response.data!.url }));
        }
      } catch (err) {
        setError('Не удалось загрузить изображение');
        setImagePreview(null);
        URL.revokeObjectURL(localPreview);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.createPost({
        type: formData.type as PostType,
        animalType: formData.animalType as AnimalType,
        title: formData.title || `${formData.type === PostType.LOST ? 'Пропал' : 'Найден'} ${animalTypeLabels[formData.animalType as AnimalType]}`,
        description: formData.description || '',
        location: formData.location || '',
        latitude: formData.latitude,
        longitude: formData.longitude,
        contactInfo: formData.contactInfo || '',
        reward: formData.reward,
        imageUrl: formData.imageUrl,
      });

      if (response.error) {
        setError(response.error);
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Не удалось создать объявление. Попробуйте ещё раз.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Новое объявление</h2>
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
                    placeholder={`например, ${formData.type === PostType.LOST ? 'Пропал золотистый ретривер' : 'Найден маленький котёнок'}`}
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
                    placeholder="Опишите особые приметы, ошейник, поведение..."
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                />
                <p className="text-xs text-gray-500 mt-1">Подробное описание помогает находить совпадения.</p>
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
                        {showMap ? 'Скрыть карту' : 'Выбрать на карте'}
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
                        placeholder="Город, район или адрес"
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                )}
                {formData.latitude && formData.longitude && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Координаты сохранены
                    </p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Вознаграждение (необязательно)</label>
                <input
                    type="text"
                    name="reward"
                    value={formData.reward}
                    onChange={handleInputChange}
                    placeholder="Сумма"
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
                    placeholder="Телефон или Email"
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Фото</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors cursor-pointer relative">
                    <div className="space-y-1 text-center">
                        {(formData.imageUrl || imagePreview) ? (
                            <div className="relative">
                                <img src={formData.imageUrl || imagePreview || ''} alt="Preview" className={`mx-auto h-48 object-contain ${isUploading ? 'opacity-50' : ''}`} />
                                {isUploading && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    </div>
                                )}
                                {!isUploading && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (imagePreview) URL.revokeObjectURL(imagePreview);
                                            setFormData(prev => ({ ...prev, imageUrl: '' }));
                                            setImagePreview(null);
                                        }}
                                        className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div className="flex text-sm text-gray-600 justify-center">
                                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                        <span>Загрузить файл</span>
                                        <input type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500">PNG, JPG до 10 МБ</p>
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
                disabled={isSubmitting || isUploading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {isSubmitting ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Публикация...
                    </>
                ) : isUploading ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Загрузка фото...
                    </>
                ) : 'Опубликовать'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default CreatePost;
