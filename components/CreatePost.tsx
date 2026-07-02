import React, { useState } from 'react';

import { api } from '../services/api';
import { AnimalType, PetPost, PostType } from '../types';
import AddressAutocomplete from './AddressAutocomplete';
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
  const [formData, setFormData] = useState<
    Partial<PetPost> & { latitude?: number; longitude?: number }
  >({
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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
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
      } catch {
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
        title:
          formData.title ||
          `${formData.type === PostType.LOST ? 'Пропал' : 'Найден'} ${animalTypeLabels[formData.animalType as AnimalType]}`,
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
    } catch {
      setError('Не удалось создать объявление. Попробуйте ещё раз.');
      // Error logged to UI state
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-coral-50 to-teal-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Новое объявление</h2>
              <p className="text-sm text-gray-500 mt-1">Заполните информацию о питомце</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white/50 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-4 p-3 bg-coral-50 border border-coral-200 rounded-xl text-coral-700 text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type Selection */}
            <div className="flex gap-2 p-1.5 bg-gray-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, type: PostType.LOST }))}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${formData.type === PostType.LOST ? 'bg-coral-500 text-white shadow-lg shadow-coral-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Пропал питомец
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, type: PostType.FOUND }))}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${formData.type === PostType.FOUND ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Найден питомец
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Тип животного
              </label>
              <select
                name="animalType"
                value={formData.animalType}
                onChange={handleInputChange}
                className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-coral-500 focus:border-transparent transition-all bg-white"
              >
                {Object.values(AnimalType).map(t => (
                  <option key={t} value={t}>
                    {animalTypeLabels[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Заголовок</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder={`например, ${formData.type === PostType.LOST ? 'Пропал золотистый ретривер' : 'Найден маленький котёнок'}`}
                className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-coral-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Описание</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Опишите особые приметы, ошейник, поведение..."
                rows={4}
                className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-coral-500 focus:border-transparent transition-all resize-none"
                required
              />
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Подробное описание помогает находить совпадения
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Местоположение</label>
                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <AddressAutocomplete
                  value={formData.location || ''}
                  onChange={value => setFormData(prev => ({ ...prev, location: value }))}
                  onSelect={(address, lat, lon) =>
                    setFormData(prev => ({
                      ...prev,
                      location: address,
                      latitude: lat,
                      longitude: lon,
                    }))
                  }
                  placeholder="Начните вводить город, район или адрес"
                  className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-coral-500 focus:border-transparent transition-all"
                  required
                />
              )}
              {formData.latitude && formData.longitude && (
                <p className="text-xs text-teal-600 mt-1.5 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Координаты сохранены
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Вознаграждение (необязательно)
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="reward"
                  value={formData.reward}
                  onChange={handleInputChange}
                  placeholder="Сумма"
                  className="w-full border border-gray-200 rounded-xl p-3 pl-10 focus:ring-2 focus:ring-coral-500 focus:border-transparent transition-all"
                />
                <svg
                  className="w-5 h-5 absolute left-3 top-3.5 text-warm-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Контактная информация
              </label>
              <input
                type="text"
                name="contactInfo"
                value={formData.contactInfo}
                onChange={handleInputChange}
                placeholder="Телефон или Email"
                className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-coral-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Фото</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-200 border-dashed rounded-2xl hover:bg-gray-50 hover:border-coral-300 transition-all cursor-pointer relative group">
                <div className="space-y-1 text-center">
                  {formData.imageUrl || imagePreview ? (
                    <div className="relative">
                      <img
                        src={formData.imageUrl || imagePreview || ''}
                        alt="Preview"
                        className={`mx-auto h-48 object-contain rounded-lg ${isUploading ? 'opacity-50' : ''}`}
                      />
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-coral-500"></div>
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
                          className="absolute -top-2 -right-2 bg-coral-500 text-white p-1.5 rounded-full hover:bg-coral-600 shadow-lg transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center group-hover:bg-coral-100 transition-colors">
                        <svg
                          className="w-8 h-8 text-gray-400 group-hover:text-coral-500 transition-colors"
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
                      </div>
                      <div className="flex text-sm text-gray-600 justify-center mt-3">
                        <label className="relative cursor-pointer font-medium text-coral-600 hover:text-coral-500 transition-colors">
                          <span>Загрузить фото</span>
                          <input
                            type="file"
                            className="sr-only"
                            onChange={handleImageUpload}
                            accept="image/*"
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG до 10 МБ</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-white font-medium transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading}
            className="px-6 py-2.5 bg-gradient-to-r from-coral-500 to-coral-600 text-white rounded-xl hover:from-coral-600 hover:to-coral-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-lg shadow-coral-200 transition-all"
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
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Опубликовать
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
