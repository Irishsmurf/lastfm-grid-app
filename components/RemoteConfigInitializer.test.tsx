import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import RemoteConfigInitializer from './RemoteConfigInitializer';
import { initializeRemoteConfig } from '@/lib/firebase';

// Mock the initializeRemoteConfig function
jest.mock('@/lib/firebase', () => ({
  initializeRemoteConfig: jest.fn().mockResolvedValue(undefined),
}));

describe('RemoteConfigInitializer', () => {
  it('calls initializeRemoteConfig on mount', () => {
    render(<RemoteConfigInitializer />);
    expect(initializeRemoteConfig).toHaveBeenCalledTimes(1);
  });
});
