import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeToggleButton } from './theme-toggle-button';
import { useTheme } from './theme-provider';

// Mock the useTheme hook
jest.mock('./theme-provider', () => ({
  useTheme: jest.fn(),
}));

describe('ThemeToggleButton', () => {
  it('renders correctly and toggles theme', () => {
    const setTheme = jest.fn();
    (useTheme as jest.Mock).mockReturnValue({ theme: 'light', setTheme });

    const { rerender } = render(<ThemeToggleButton />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();

    // Check for initial theme (light)
    expect(screen.getByText(/Toggle theme/i)).toBeInTheDocument();

    // Simulate a click to toggle theme
    fireEvent.click(button);
    expect(setTheme).toHaveBeenCalledWith('dark');

    // Change the theme to dark and re-render
    (useTheme as jest.Mock).mockReturnValue({ theme: 'dark', setTheme });
    rerender(<ThemeToggleButton />);

    // Simulate another click to toggle theme back to light
    fireEvent.click(button);
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
