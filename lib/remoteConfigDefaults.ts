/**
 * Remote Config defaults, deliberately kept in a module with no Firebase import.
 *
 * These are plain values, but they used to live in `lib/firebase.ts`. Anything
 * reading them therefore pulled in `firebase/app` + `firebase/remote-config` and
 * triggered `initializeApp()` at module scope — which is how the whole SDK ended
 * up in the home page's first-load bundle just to read a default time period.
 */
export const defaultRemoteConfig = {
  show_footer_feature_text: false, // Default value for our example feature
  default_time_period: '1month', // Default time period
  lastfm_cache_expiry_seconds: 3600, // Default cache expiry in seconds
  not_found_cache_expiry_seconds: 86400, // Default not found cache expiry in seconds
  spotify_cache_expiry_seconds: 3600, // Default Spotify cache expiry in seconds
  // FTUE Defaults
  ftue_enabled: true,
  welcome_message_variant: 'short_intro', // "none", "short_intro", "detailed_guide"
  welcome_message_text_short:
    'Welcome to Gridify! Generate your Last.fm album grid below.',
  welcome_message_text_detailed:
    "Get started with Gridify in 3 simple steps: 1. Enter your Last.fm username. 2. Choose a time period. 3. Click 'Generate Grid'!",
  highlight_initial_action: 'username_input', // "none", "username_input", "generate_button"
  prefill_example_username: false,
  example_username_value: 'musiclover123',
};

export type RemoteConfigDefaults = typeof defaultRemoteConfig;
