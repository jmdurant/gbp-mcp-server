/**
 * Business Information tools — InsightfulPipe parity:
 *   get_location_details, get_location_attributes, get_available_attributes,
 *   get_services, get_categories, get_batch_categories, get_verifications
 */

import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BusinessInfoService } from '../../services/businessInfoService.js';

export function createGetLocationDetailsTool(svc: BusinessInfoService) {
    return {
        schema: {
            title: 'Get Location Details',
            description: 'Retrieve metadata for a Google Business Profile location (title, phone, hours, categories, address, website).',
            inputSchema: {
                locationName: z.string().describe('locations/{locationId}'),
                readMask: z.string().optional().describe('Comma-separated list of fields to return')
            },
            outputSchema: { name: z.string().optional() }
        },
        handler: async (args: any): Promise<CallToolResult> => {
            try {
                const result = await svc.getLocation(args.locationName, args.readMask);
                return {
                    content: [{ type: 'text', text: `Location ${args.locationName}` }],
                    structuredContent: result as any
                };
            } catch (e) { return errorResult('get_location_details', e); }
        }
    };
}

export function createGetLocationAttributesTool(svc: BusinessInfoService) {
    return {
        schema: {
            title: 'Get Location Attributes',
            description: 'Get the current set of attributes (e.g. wheelchair_accessible, lgbtq_friendly) on a location.',
            inputSchema: { locationName: z.string() },
            outputSchema: { attributes: z.array(z.any()).optional() }
        },
        handler: async (args: any): Promise<CallToolResult> => {
            try {
                const result = await svc.getAttributes(args.locationName);
                return {
                    content: [{ type: 'text', text: `Attributes for ${args.locationName}` }],
                    structuredContent: result as any
                };
            } catch (e) { return errorResult('get_location_attributes', e); }
        }
    };
}

export function createGetAvailableAttributesTool(svc: BusinessInfoService) {
    return {
        schema: {
            title: 'Get Available Attributes',
            description: 'List attributes that are AVAILABLE for a category in a region — the catalog you can pick from.',
            inputSchema: {
                categoryName: z.string().describe('categories/{categoryId} (e.g. categories/gcid:doctor)'),
                regionCode: z.string().default('US'),
                languageCode: z.string().default('en'),
                pageSize: z.number().optional().default(50)
            },
            outputSchema: { attributes: z.array(z.any()).optional(), nextPageToken: z.string().optional() }
        },
        handler: async (args: any): Promise<CallToolResult> => {
            try {
                const result = await svc.availableAttributes(args.categoryName, args.regionCode, args.languageCode, args.pageSize);
                return {
                    content: [{ type: 'text', text: `Available attributes for ${args.categoryName} (${args.regionCode})` }],
                    structuredContent: result as any
                };
            } catch (e) { return errorResult('get_available_attributes', e); }
        }
    };
}

export function createGetServicesTool(svc: BusinessInfoService) {
    return {
        schema: {
            title: 'Get Services',
            description: 'Retrieve serviceItems for a location (use readMask=serviceItems on the location resource).',
            inputSchema: { locationName: z.string() },
            outputSchema: { serviceItems: z.array(z.any()).optional() }
        },
        handler: async (args: any): Promise<CallToolResult> => {
            try {
                const result = await svc.getLocation(args.locationName, 'serviceItems');
                return {
                    content: [{ type: 'text', text: `Services for ${args.locationName}` }],
                    structuredContent: result as any
                };
            } catch (e) { return errorResult('get_services', e); }
        }
    };
}

export function createGetCategoriesTool(svc: BusinessInfoService) {
    return {
        schema: {
            title: 'Get Categories',
            description: 'List Business Profile categories with predefined services. Filter by region/language and free-text filter.',
            inputSchema: {
                regionCode: z.string().default('US'),
                languageCode: z.string().default('en'),
                filter: z.string().optional().describe('e.g. displayName=*doctor*'),
                view: z.enum(['BASIC', 'FULL', 'CATEGORY_VIEW_UNSPECIFIED']).default('BASIC'),
                pageSize: z.number().optional().default(100)
            },
            outputSchema: { categories: z.array(z.any()).optional(), nextPageToken: z.string().optional() }
        },
        handler: async (args: any): Promise<CallToolResult> => {
            try {
                const result = await svc.listCategories({
                    regionCode: args.regionCode,
                    languageCode: args.languageCode,
                    filter: args.filter,
                    view: args.view,
                    pageSize: args.pageSize
                });
                return {
                    content: [{ type: 'text', text: `Categories (${args.regionCode}/${args.languageCode})` }],
                    structuredContent: result as any
                };
            } catch (e) { return errorResult('get_categories', e); }
        }
    };
}

export function createGetBatchCategoriesTool(svc: BusinessInfoService) {
    return {
        schema: {
            title: 'Get Batch Categories',
            description: 'Resolve specific category IDs to their full details (service types, etc.).',
            inputSchema: {
                names: z.array(z.string()).min(1).describe('Array of categories/{categoryId}'),
                regionCode: z.string().default('US'),
                languageCode: z.string().default('en'),
                view: z.enum(['BASIC', 'FULL', 'CATEGORY_VIEW_UNSPECIFIED']).default('FULL')
            },
            outputSchema: { categories: z.array(z.any()).optional() }
        },
        handler: async (args: any): Promise<CallToolResult> => {
            try {
                const result = await svc.batchCategories(args.names, {
                    regionCode: args.regionCode,
                    languageCode: args.languageCode,
                    view: args.view
                });
                return {
                    content: [{ type: 'text', text: `Batch resolved ${args.names.length} categories` }],
                    structuredContent: result as any
                };
            } catch (e) { return errorResult('get_batch_categories', e); }
        }
    };
}

export function createGetVerificationsTool(svc: BusinessInfoService) {
    return {
        schema: {
            title: 'Get Verifications',
            description: 'List verification attempts (and their states) for a location.',
            inputSchema: { locationName: z.string() },
            outputSchema: { verifications: z.array(z.any()).optional() }
        },
        handler: async (args: any): Promise<CallToolResult> => {
            try {
                const result = await svc.verifications(args.locationName);
                return {
                    content: [{ type: 'text', text: `Verifications for ${args.locationName}` }],
                    structuredContent: result as any
                };
            } catch (e) { return errorResult('get_verifications', e); }
        }
    };
}

function errorResult(toolName: string, e: unknown): CallToolResult {
    logger.error(`${toolName} failed`, e);
    return {
        content: [{ type: 'text', text: `${toolName} failed: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true
    };
}
