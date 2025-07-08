import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FooterFeatureText from './FooterFeatureText'; // Adjust path if necessary

// Mock Firebase Remote Config
const mockGetValue = jest.fn();
const mockFetchAndActivate = jest.fn();

jest.mock('@/lib/firebase', () => ({
  remoteConfig: {
    settings: {
      minimumFetchIntervalMillis: 0, // Or some other mock value
    },
    defaultConfig: {}, // Or some mock default config
  },
}));

jest.mock('firebase/remote-config', () => ({
  fetchAndActivate: () => mockFetchAndActivate(),
  getValue: (config: any, key: string) => mockGetValue(key),
}));

describe('FooterFeatureText Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockGetValue.mockReset();
    mockFetchAndActivate.mockReset();
  });

  test('renders nothing while loading', async () => {
    mockFetchAndActivate.mockImplementation(() => new Promise(() => {})); // Never resolves to simulate loading

    render(<FooterFeatureText />);
    // Expect nothing to be rendered initially or a specific loader if implemented
    expect(
      screen.queryByText(/Experimental Feature Active!/)
    ).not.toBeInTheDocument();
  });

  test('renders the feature text when the flag is true', async () => {
    mockFetchAndActivate.mockResolvedValue(true); // Simulate successful fetch and activation
    mockGetValue.mockImplementation((key: string) => {
      if (key === 'show_footer_feature_text') {
        return { asBoolean: () => true };
      }
      return { asBoolean: () => false }; // Default for other keys
    });

    render(<FooterFeatureText />);

    // Wait for the component to update after fetching config
    await waitFor(() => {
      expect(
        screen.getByText(/Experimental Feature Active!/)
      ).toBeInTheDocument();
    });
  });

  test('does not render the feature text when the flag is false', async () => {
    mockFetchAndActivate.mockResolvedValue(true); // Simulate successful fetch and activation
    mockGetValue.mockImplementation((key: string) => {
      if (key === 'show_footer_feature_text') {
        return { asBoolean: () => false };
      }
      return { asBoolean: () => false }; // Default for other keys
    });

    render(<FooterFeatureText />);

    // Wait for the component to update after fetching config
    await waitFor(() => {
      expect(
        screen.queryByText(/Experimental Feature Active!/)
      ).not.toBeInTheDocument();
    });
  });

  test('does not render the feature text if fetching config fails', async () => {
    mockFetchAndActivate.mockRejectedValue(new Error('Failed to fetch')); // Simulate fetch error

    render(<FooterFeatureText />);

    // Wait for the component to handle the error
    await waitFor(() => {
      expect(
        screen.queryByText(/Experimental Feature Active!/)
      ).not.toBeInTheDocument();
    });
  });
});
