# Changes from upstream

This is a fork of [satheeshds/gbp-review-agent](https://github.com/satheeshds/gbp-review-agent) extending the scope from "reviews only" to the full Google Business Profile surface.

## v0.2.0 (forked)

### New service stubs (mock-mode runnable today, real GBP API wired when API access is approved)

- `postService` — local posts: list, create, update, delete (STANDARD/EVENT/OFFER/ALERT)
- `qaService` — questions + answers (list, owner-upsert, delete) on the dedicated `mybusinessqanda` host
- `mediaService` — photos and videos (list, create from URL, start streamed upload, delete)
- `insightsService` — Business Profile Performance API: daily/multi-daily metrics, monthly search keywords
- `businessInfoService` — locations, attributes, categories, services, verifications across `mybusinessbusinessinformation` and `mybusinessverifications`

### apiClient extensions

- `delete()` and `patch()` HTTP methods (needed for posts update, media delete, attribute updates, etc.)
- `baseUrl` arg on every method — GBP is fragmented across multiple hosts (legacy v4, BUSINESS_INFO, QANDA, PERFORMANCE, VERIFICATIONS, ACCOUNT_MGMT). Routes pick the right host per call.
- `GOOGLE_API.HOSTS` constant enumerates the 7 sub-API hosts.

### Why the fork

Upstream covers reviews well. For a private medical practice doing local SEO, reviews are a medium-impact lever; posts and Q&A are higher-impact and need to be in the same MCP. Splitting concerns across multiple servers would balloon the auth surface and confuse the agent's tool selection.

### Roadmap

- [ ] Wire posts service tools into mcpServer.ts (registration + handler scaffolding ready)
- [ ] Wire Q&A tools
- [ ] Wire media tools (with URL-source upload first; byte upload requires multipart support)
- [ ] Wire insights tools
- [ ] Wire business info / attributes tools
- [ ] OAuth scope check for additional sub-APIs (current `business.manage` covers most; verify Performance API)
- [ ] End-to-end test against live GBP once API approval lands
- [ ] Optional: open-source the fork once stable — there's a real ecosystem gap here
