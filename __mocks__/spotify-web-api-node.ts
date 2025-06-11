// __mocks__/spotify-web-api-node.ts
const mockSpotifyWebApi = {
  setAccessToken: jest.fn(),
  setRefreshToken: jest.fn(),
  clientCredentialsGrant: jest.fn(),
  refreshAccessToken: jest.fn(),
  createAuthorizeURL: jest.fn(),
  authorizationCodeGrant: jest.fn(),
  searchAlbums: jest.fn(),
  getAlbumTracks: jest.fn(),
  getTracks: jest.fn(),
  getMe: jest.fn(),
  createPlaylist: jest.fn(),
  addTracksToPlaylist: jest.fn(),
};

const SpotifyWebApi = jest.fn(() => mockSpotifyWebApi);

// Static member for the constructor mock itself
(SpotifyWebApi as any).mockInstance = mockSpotifyWebApi;

export default SpotifyWebApi;
