/**
 * Media service — photos and videos on a Google Business Profile location.
 *
 * GBP API surface: legacy v4
 *   GET    accounts/{a}/locations/{l}/media                → list
 *   POST   accounts/{a}/locations/{l}/media                → create from sourceUrl
 *   POST   accounts/{a}/locations/{l}/media:startUpload    → begin byte upload (returns resourceName)
 *   DELETE accounts/{a}/locations/{l}/media/{m}            → delete
 *
 * STATUS: stubbed.
 */

import { GoogleMyBusinessApiClient } from './apiClient.js';
import { logger } from '../utils/logger.js';

export type MediaCategory =
    | 'COVER' | 'PROFILE' | 'LOGO' | 'EXTERIOR' | 'INTERIOR'
    | 'PRODUCT' | 'AT_WORK' | 'FOOD_AND_DRINK' | 'MENU' | 'COMMON_AREA'
    | 'ROOMS' | 'TEAMS' | 'ADDITIONAL';

export interface MediaItem {
    name?: string;
    mediaFormat: 'PHOTO' | 'VIDEO';
    locationAssociation?: { category?: MediaCategory; priceListItemId?: string };
    googleUrl?: string;
    thumbnailUrl?: string;
    createTime?: string;
    sourceUrl?: string;
    dataRef?: { resourceName: string };
    description?: string;
    attribution?: any;
}

export class MediaService {
    constructor(private apiClient: GoogleMyBusinessApiClient, private mockMode = false) {}

    async list(locationName: string, pageSize = 100, pageToken?: string) {
        if (this.mockMode) return { mediaItems: [], totalMediaItemCount: 0, nextPageToken: undefined };
        return this.apiClient.get<{ mediaItems: MediaItem[]; totalMediaItemCount: number; nextPageToken?: string }>(
            `${locationName}/media`,
            { pageSize, pageToken }
        );
    }

    async createFromUrl(locationName: string, sourceUrl: string, category: MediaCategory, format: 'PHOTO' | 'VIDEO' = 'PHOTO', description?: string) {
        if (this.mockMode) {
            logger.info('mock mediaService.createFromUrl', { locationName, sourceUrl, category });
            return { name: `${locationName}/media/mock-${Date.now()}`, mediaFormat: format, sourceUrl, locationAssociation: { category } } as MediaItem;
        }
        return this.apiClient.post<MediaItem>(`${locationName}/media`, {
            mediaFormat: format,
            sourceUrl,
            locationAssociation: { category },
            description
        });
    }

    async startUpload(locationName: string) {
        if (this.mockMode) return { resourceName: `${locationName}/media/mock-upload-${Date.now()}` };
        return this.apiClient.post<{ resourceName: string }>(`${locationName}/media:startUpload`, {});
    }

    async delete(mediaName: string) {
        if (this.mockMode) { logger.info('mock mediaService.delete', { mediaName }); return { ok: true }; }
        await this.apiClient.delete(mediaName);
        return { ok: true };
    }
}
