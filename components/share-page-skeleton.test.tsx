import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SharePageSkeleton from './share-page-skeleton';

describe('SharePageSkeleton', () => {
  it('renders correctly', () => {
    render(<SharePageSkeleton />);
    expect(screen.getByTestId('skeleton-container')).toBeInTheDocument();
  });
});
