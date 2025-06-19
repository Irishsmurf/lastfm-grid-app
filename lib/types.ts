import { MinimizedAlbum } from './minimizedLastfmService';

// Re-export MinimizedAlbum so it can be imported from 'lib/types'
export type { MinimizedAlbum };

export interface SharedGridData {
  id: string;
  username: string;
  period: string;
  albums: MinimizedAlbum[];
  createdAt: string;
}
