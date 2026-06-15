import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FooterFeatureText from './FooterFeatureText';
import { useRemoteConfig } from '@/lib/remoteConfigContext';

jest.mock('@/lib/remoteConfigContext', () => ({
  useRemoteConfig: jest.fn(),
}));

const mockUseRemoteConfig = useRemoteConfig as jest.Mock;

describe('FooterFeatureText Component', () => {
  beforeEach(() => {
    mockUseRemoteConfig.mockReset();
  });

  test('renders nothing when feature flag is disabled', () => {
    mockUseRemoteConfig.mockReturnValue({
      footer_feature_text: { enabled: false, text: '' },
    });

    render(<FooterFeatureText />);
    expect(
      screen.queryByText(/Experimental Feature Active!/)
    ).not.toBeInTheDocument();
  });

  test('renders the feature text when the flag is enabled', () => {
    mockUseRemoteConfig.mockReturnValue({
      footer_feature_text: {
        enabled: true,
        text: 'Experimental Feature Active!',
      },
    });

    render(<FooterFeatureText />);
    expect(
      screen.getByText('Experimental Feature Active!')
    ).toBeInTheDocument();
  });

  test('renders nothing when feature flag is missing from config', () => {
    mockUseRemoteConfig.mockReturnValue({
      footer_feature_text: { enabled: false, text: '' },
    });

    render(<FooterFeatureText />);
    expect(
      screen.queryByText('Experimental Feature Active!')
    ).not.toBeInTheDocument();
  });
});
