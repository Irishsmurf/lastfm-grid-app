import { MinimizedAlbum } from './minimizedLastfmService';

export interface SharedGridData {
  id: string;
  username: string;
  period: string;
  albums: MinimizedAlbum[];
  createdAt: string; // ISO date string
}
