/**
 * Business Information service — location metadata, attributes, services,
 * categories, and verification status.
 *
 * GBP API surface: HOSTS.BUSINESS_INFO (mybusinessbusinessinformation.googleapis.com/v1)
 *   GET    locations/{l}                                  → location details (readMask)
 *   PATCH  locations/{l}                                  → update fields (updateMask)
 *   GET    locations/{l}/attributes                       → current attributes
 *   PATCH  locations/{l}/attributes                       → set attributes (updateMask)
 *   GET    attributes (?categoryName=, regionCode=, ...)  → available attributes for category/region
 *   GET    categories  (?regionCode=, languageCode=, ...) → list categories with predefined services
 *   POST   categories:batchGet                            → resolve specific category IDs to service items
 *
 * Verifications surface: HOSTS.VERIFICATIONS (mybusinessverifications.googleapis.com/v1)
 *   GET locations/{l}/verifications                       → list verification attempts
 *
 * STATUS: stubbed.
 */

import { GoogleMyBusinessApiClient } from './apiClient.js';
import { GOOGLE_API } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

export class BusinessInfoService {
    constructor(private apiClient: GoogleMyBusinessApiClient, private mockMode = false) {}

    async getLocation(locationName: string, readMask?: string) {
        if (this.mockMode) return this.mockLocation(locationName);
        return this.apiClient.get(locationName, readMask ? { readMask } : undefined, GOOGLE_API.HOSTS.BUSINESS_INFO);
    }

    async updateLocation(locationName: string, body: any, updateMask: string) {
        if (this.mockMode) { logger.info('mock updateLocation', { locationName, updateMask }); return { ...body, name: locationName }; }
        return this.apiClient.patch(locationName, body, { updateMask }, GOOGLE_API.HOSTS.BUSINESS_INFO);
    }

    async getAttributes(locationName: string) {
        if (this.mockMode) return { name: `${locationName}/attributes`, attributes: [] };
        return this.apiClient.get(`${locationName}/attributes`, undefined, GOOGLE_API.HOSTS.BUSINESS_INFO);
    }

    async setAttributes(locationName: string, attributes: any[]) {
        if (this.mockMode) { logger.info('mock setAttributes', { locationName, count: attributes.length }); return { attributes }; }
        return this.apiClient.patch(`${locationName}/attributes`, { attributes }, { updateMask: 'attributes' }, GOOGLE_API.HOSTS.BUSINESS_INFO);
    }

    async availableAttributes(categoryName: string, regionCode = 'US', languageCode = 'en', pageSize = 50) {
        if (this.mockMode) return { attributes: [], nextPageToken: undefined };
        return this.apiClient.get(
            'attributes',
            { categoryName, regionCode, languageCode, pageSize },
            GOOGLE_API.HOSTS.BUSINESS_INFO
        );
    }

    async listCategories(opts: { regionCode?: string; languageCode?: string; filter?: string; view?: string; pageSize?: number } = {}) {
        if (this.mockMode) return { categories: [], nextPageToken: undefined };
        return this.apiClient.get(
            'categories',
            { regionCode: 'US', languageCode: 'en', view: 'BASIC', pageSize: 100, ...opts },
            GOOGLE_API.HOSTS.BUSINESS_INFO
        );
    }

    async batchCategories(names: string[], opts: { regionCode?: string; languageCode?: string; view?: string } = {}) {
        if (this.mockMode) return { categories: [] };
        return this.apiClient.get(
            'categories:batchGet',
            { names: names.join(','), regionCode: 'US', languageCode: 'en', view: 'FULL', ...opts },
            GOOGLE_API.HOSTS.BUSINESS_INFO
        );
    }

    async verifications(locationName: string) {
        if (this.mockMode) return { verifications: [] };
        return this.apiClient.get(`${locationName}/verifications`, undefined, GOOGLE_API.HOSTS.VERIFICATIONS);
    }

    private mockLocation(locationName: string) {
        return {
            name: locationName,
            languageCode: 'en',
            storeCode: 'CLT-001',
            title: 'Dr. James DuRant — Sexual Health Clinic',
            phoneNumbers: { primaryPhone: '+18432521351' },
            categories: { primaryCategory: { name: 'categories/gcid:sexologist' } },
            websiteUri: 'https://doctordurant.com',
            regularHours: { periods: [] }
        };
    }
}
