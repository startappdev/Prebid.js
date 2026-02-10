## Start.io User ID Submodule

The Start.io User ID submodule generates and persists a unique user identifier by fetching it from a publisher-supplied endpoint. The ID is stored in both cookies and local storage for subsequent page loads and is made available to other Prebid.js modules via the standard `eids` interface.

For integration support, contact prebid@start.io.

### Prebid Params Enabling User Sync

To enable iframe-based user syncing for Start.io, include the `filterSettings` configuration in your `userSync` setup:

```javascript
pbjs.setConfig({
    userSync: {
        userIds: [{
            name: 'startioId'
        }],
        filterSettings: {
            iframe: {
                bidders: ['startio'],
                filter: 'include'
            }
        }
    }
});
```

This configuration allows Start.io to sync user data via iframe, which is necessary for cross-domain user identification.

## Parameter Descriptions for the `userSync` Configuration Section

The below parameters apply only to the Start.io User ID integration.

| Param under userSync.userIds[] | Scope | Type | Description | Example |
| --- | --- | --- | --- | --- |
| name | Required | String | The name of this module. | `"startioId"` |

## Server Response Format

The endpoint specified in `params.endpoint` must return a JSON response containing an `uid` field:

```
{
  "uid": "unique-user-identifier-string"
}
```

If the `uid` field is missing or the response cannot be parsed, the module logs an error and does not store a value.

## How It Works

1. On the first page load (no stored ID exists), the module sends a `GET` request to the configured `endpoint`.
2. The returned `id` is written to both cookies and local storage (respecting the `storage` configuration).
3. On subsequent loads the stored ID is returned directly — no network request is made.
4. The ID is exposed to other modules via the extended ID (`eids`) framework with source `start.io` and `atype: 3`.

## Notes

- The `endpoint` parameter is required. The module will log an error and return no ID if it is missing or not a string.
- Storage defaults to both cookies and local storage when no explicit `storage.type` is provided. The module checks whether each mechanism is available before writing.
- Cookie expiration is set to `storage.expires` days from the time the ID is first fetched (default 365 days).
