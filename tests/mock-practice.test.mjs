import assert from 'node:assert/strict';
import test from 'node:test';
import {MockReviewService} from '../build/services/mockReviewService.js';
import {QAService} from '../build/services/qaService.js';
import {BusinessInfoService} from '../build/services/businessInfoService.js';
import {InsightsService} from '../build/services/insightsService.js';

test('the configured practice uses its own listing, reviews, and question at both Google resource paths', async (t) => {
    t.mock.method(globalThis, 'fetch', () => { throw Error('Unexpected external request'); });
    const saved = process.env.GBP_MOCK_PRACTICE_NAME;
    t.after(() => {
        if (saved === undefined) delete process.env.GBP_MOCK_PRACTICE_NAME;
        else process.env.GBP_MOCK_PRACTICE_NAME = saved;
    });
    process.env.GBP_MOCK_PRACTICE_NAME = 'Example Practice';
    const reviews = new MockReviewService();
    const qa = new QAService(null, true);
    const business = new BusinessInfoService(null, true);
    const insights = new InsightsService(null, true);
    const {locations} = (await reviews.listLocations()).data;
    assert.equal(locations.length, 1);
    const location = locations[0];
    assert.equal(location.locationName, 'Example Practice');
    const shortName = location.name.replace(/^accounts\/[^/]+\//, '');
    for (const name of [shortName, location.name]) {
        const info = await business.getLocation(name);
        assert.deepEqual([info.name, info.title, info.phoneNumbers], [shortName, 'Example Practice', undefined]);
        const {questions} = await qa.listQuestions(name);
        assert.equal(questions.length, 1);
        assert.ok(questions[0].name.startsWith(shortName + '/questions/'));
    }
    const profile = (await reviews.getBusinessProfile(location.name)).data;
    assert.equal(profile.businessType, 'medical_clinic');
    const genuine = (await reviews.getUnrepliedReviews(location.name)).data;
    assert.deepEqual(genuine.map(row => row.starRating), ['FIVE', 'THREE']);
    assert.equal((await reviews.getUnrepliedReviews('accounts/mock123/locations/loc456')).success, false);
    await assert.rejects(qa.listQuestions('locations/456'), /Unknown mock practice/);
    assert.equal((await insights.searchKeywords(location.name, {})).searchKeywordsCounts[0].searchKeyword, 'clinic registration');
    delete process.env.GBP_MOCK_PRACTICE_NAME;
    assert.equal((await new MockReviewService().listLocations()).data.locations.length, 2);
});
