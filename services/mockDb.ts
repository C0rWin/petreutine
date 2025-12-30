import { PetPost, PostType, AnimalType, User } from '../types';

// Mock Initial Data
const INITIAL_POSTS: PetPost[] = [
  {
    id: '1',
    userId: 'u2',
    user: { id: 'u2', name: 'Анна Петрова', email: 'anna@example.com', verified: true },
    type: PostType.LOST,
    animalType: AnimalType.DOG,
    status: 'OPEN',
    title: 'Пропал золотистый ретривер "Бадди"',
    description: 'Наш любимый Бадди пропал возле Центрального парка. Он дружелюбный, носит красный ошейник. 3 года.',
    location: 'Москва, Центральный район',
    contactInfo: '+7-999-123-4567',
    reward: '50 000 ₽',
    imageUrl: 'https://picsum.photos/400/300?random=1',
    createdAt: Date.now() - 86400000,
  },
  {
    id: '2',
    userId: 'u3',
    user: { id: 'u3', name: 'Иван Сидоров', email: 'ivan@example.com', verified: true },
    type: PostType.FOUND,
    animalType: AnimalType.CAT,
    status: 'OPEN',
    title: 'Найден чёрный кот с белыми лапками',
    description: 'Нашёл испуганного котика у себя во дворе. На левом ухе небольшая царапина. Без ошейника.',
    location: 'Санкт-Петербург, Невский район',
    contactInfo: 'ivan.sidorov@email.com',
    imageUrl: 'https://picsum.photos/400/300?random=2',
    createdAt: Date.now() - 172800000,
  },
  {
    id: '3',
    userId: 'u4',
    user: { id: 'u4', name: 'Мария Козлова', email: 'maria@example.com', verified: true },
    type: PostType.LOST,
    animalType: AnimalType.CAT,
    status: 'OPEN',
    title: 'Пропала полосатая кошка "Луна"',
    description: 'Луна — застенчивая полосатая кошка. Пропала во вторник. Пожалуйста, помогите её найти.',
    location: 'Москва, Измайлово',
    contactInfo: '+7-999-765-4321',
    reward: '10 000 ₽',
    imageUrl: 'https://picsum.photos/400/300?random=3',
    createdAt: Date.now() - 43200000,
  }
];

const MOCK_USER: User = {
  id: 'u1',
  name: 'Текущий пользователь',
  email: 'user@example.com',
  verified: true, // Auto-verify for demo
  avatarUrl: 'https://picsum.photos/100/100?random=99',
};

// Simulation of a database
class MockDB {
  private posts: PetPost[];
  private currentUser: User | null = null;

  constructor() {
    const storedPosts = localStorage.getItem('petreunite_posts');
    this.posts = storedPosts ? JSON.parse(storedPosts) : INITIAL_POSTS;
  }

  getPosts(): PetPost[] {
    return [...this.posts].sort((a, b) => b.createdAt - a.createdAt);
  }

  addPost(post: PetPost): void {
    this.posts.unshift(post);
    this.persist();
  }

  login(): User {
    this.currentUser = MOCK_USER;
    return this.currentUser;
  }

  logout(): void {
    this.currentUser = null;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  private persist() {
    localStorage.setItem('petreunite_posts', JSON.stringify(this.posts));
  }
}

export const db = new MockDB();