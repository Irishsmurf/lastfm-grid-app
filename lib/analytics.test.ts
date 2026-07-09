import { trackEvent } from './analytics';

describe('trackEvent', () => {
  const originalGtag = window.gtag;

  afterEach(() => {
    window.gtag = originalGtag;
  });

  it('does nothing when window.gtag is undefined', () => {
    // @ts-expect-error deliberately clearing gtag for this test
    delete window.gtag;
    expect(() => trackEvent('generate_grid', { username: 'rj' })).not.toThrow();
  });

  it('calls window.gtag with the event name and params when gtag exists', () => {
    const gtagMock = jest.fn();
    window.gtag = gtagMock;

    trackEvent('generate_grid', { username: 'rj', time_range: 'overall', grid_size: 9 });

    expect(gtagMock).toHaveBeenCalledWith('event', 'generate_grid', {
      username: 'rj',
      time_range: 'overall',
      grid_size: 9,
    });
  });

  it('calls window.gtag with no params object when none is passed', () => {
    const gtagMock = jest.fn();
    window.gtag = gtagMock;

    trackEvent('view_toggle_test_noop');

    expect(gtagMock).toHaveBeenCalledWith('event', 'view_toggle_test_noop', undefined);
  });
});
