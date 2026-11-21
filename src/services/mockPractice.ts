/** Optional practice fixture for the mock server. It has no public Google listing. */
export const mockPracticeLocation = 'locations/900000000001';
export const mockPracticeAccountLocation = 'accounts/900000000000/' + mockPracticeLocation;

export function mockPracticeName(): string | undefined {
    return process.env.GBP_MOCK_PRACTICE_NAME?.trim() || undefined;
}

export function assertMockPracticeLocation(name: string): void {
    if (name !== mockPracticeLocation && name !== mockPracticeAccountLocation) {
        throw new Error('Unknown mock practice location');
    }
}
