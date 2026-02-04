import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PetPost, PostType, User } from '../../types';
import PetCard from '../PetCard';

const mockUser: User = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
};

const createMockPost = (overrides: Partial<PetPost> = {}): PetPost => ({
  id: 'post-1',
  user: mockUser,
  type: PostType.LOST,
  status: 'OPEN',
  title: 'Test Pet Title',
  description: 'Test pet description for the card',
  location: 'Moscow, Russia',
  created_at: '2024-01-15T10:00:00Z',
  ...overrides,
});

describe('PetCard', () => {
  it('renders pet title correctly', () => {
    const post = createMockPost({ title: 'Lost Golden Retriever' });
    render(<PetCard post={post} />);

    expect(screen.getByText('Lost Golden Retriever')).toBeInTheDocument();
  });

  it('renders pet description', () => {
    const post = createMockPost({ description: 'A friendly dog went missing' });
    render(<PetCard post={post} />);

    expect(screen.getByText('A friendly dog went missing')).toBeInTheDocument();
  });

  it('renders location', () => {
    const post = createMockPost({ location: 'Central Park, NYC' });
    render(<PetCard post={post} />);

    expect(screen.getByText('Central Park, NYC')).toBeInTheDocument();
  });

  it('displays LOST badge for lost pets', () => {
    const post = createMockPost({ type: PostType.LOST });
    render(<PetCard post={post} />);

    expect(screen.getByText('ПРОПАЛ')).toBeInTheDocument();
  });

  it('displays FOUND badge for found pets', () => {
    const post = createMockPost({ type: PostType.FOUND });
    render(<PetCard post={post} />);

    expect(screen.getByText('НАЙДЕН')).toBeInTheDocument();
  });

  it('displays reward when provided', () => {
    const post = createMockPost({ reward: '10000 руб.' });
    render(<PetCard post={post} />);

    expect(screen.getByText(/Вознаграждение: 10000 руб./)).toBeInTheDocument();
  });

  it('does not display reward when not provided', () => {
    const post = createMockPost({ reward: undefined });
    render(<PetCard post={post} />);

    expect(screen.queryByText(/Вознаграждение/)).not.toBeInTheDocument();
  });

  it('displays RESOLVED overlay when status is resolved', () => {
    const post = createMockPost({ status: 'RESOLVED' });
    render(<PetCard post={post} />);

    expect(screen.getByText('ЗАВЕРШЕНО')).toBeInTheDocument();
  });

  it('does not display RESOLVED overlay when status is open', () => {
    const post = createMockPost({ status: 'OPEN' });
    render(<PetCard post={post} />);

    expect(screen.queryByText('ЗАВЕРШЕНО')).not.toBeInTheDocument();
  });

  it('renders image when imageUrl provided', () => {
    const post = createMockPost({ imageUrl: 'https://example.com/pet.jpg' });
    render(<PetCard post={post} />);

    const img = screen.getByAltText('Test Pet Title');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/pet.jpg');
  });

  it('displays placeholder when no image', () => {
    const post = createMockPost({ imageUrl: undefined, image_url: undefined });
    render(<PetCard post={post} />);

    expect(screen.getByText('Нет фото')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const post = createMockPost();
    const handleClick = vi.fn();
    render(<PetCard post={post} onClick={handleClick} />);

    fireEvent.click(screen.getByText('Test Pet Title'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('formats date correctly', () => {
    const post = createMockPost({ created_at: '2024-03-15T10:00:00Z' });
    render(<PetCard post={post} />);

    // Date format depends on locale, just check it renders a date
    expect(screen.getByText(/\d{1,2}/)).toBeInTheDocument();
  });
});
