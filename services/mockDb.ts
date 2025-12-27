import { PetPost, PostType, AnimalType, User } from '../types';

// Mock Initial Data
const INITIAL_POSTS: PetPost[] = [
  {
    id: '1',
    userId: 'u2',
    user: { id: 'u2', name: 'Jane Doe', email: 'jane@example.com', verified: true },
    type: PostType.LOST,
    animalType: AnimalType.DOG,
    status: 'OPEN',
    title: 'Lost Golden Retriever - "Buddy"',
    description: 'Our beloved Buddy went missing near Central Park. He is friendly, wears a red collar. 3 years old.',
    location: 'Manhattan, NY',
    contactInfo: '555-0101',
    reward: '$500',
    imageUrl: 'https://picsum.photos/400/300?random=1',
    createdAt: Date.now() - 86400000,
  },
  {
    id: '2',
    userId: 'u3',
    user: { id: 'u3', name: 'John Smith', email: 'john@example.com', verified: true },
    type: PostType.FOUND,
    animalType: AnimalType.CAT,
    status: 'OPEN',
    title: 'Found Black Cat with White Paws',
    description: 'Found this scared kitty in my backyard. Has a small nick on the left ear. No collar.',
    location: 'Brooklyn, NY',
    contactInfo: 'john.smith@email.com',
    imageUrl: 'https://picsum.photos/400/300?random=2',
    createdAt: Date.now() - 172800000,
  },
  {
    id: '3',
    userId: 'u4',
    user: { id: 'u4', name: 'Alice Johnson', email: 'alice@example.com', verified: true },
    type: PostType.LOST,
    animalType: AnimalType.CAT,
    status: 'OPEN',
    title: 'Missing Tabby Cat - "Luna"',
    description: 'Luna is a shy tabby cat. Missing since Tuesday. Please help us find her.',
    location: 'Queens, NY',
    contactInfo: '555-0102',
    reward: '$100',
    imageUrl: 'https://picsum.photos/400/300?random=3',
    createdAt: Date.now() - 43200000,
  }
];

const MOCK_USER: User = {
  id: 'u1',
  name: 'Current User',
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