///  Utils / Api Cache Utils
import { createHash } from 'node:crypto';

import type { H3Event } from 'h3';
import { defineEventHandler, getRequestHeader, setHeader } from 'h3';

const PRIVATE_API_CACHE_CONTROL = 'private, max-age=0, must-revalidate';

type PrivateApiHandler<T> = (event: H3Event) => T | Promise<T>;

/** Dedup map for in-flight private API GET requests by cache key. */
const pendingPrivateApiResponses = new Map<string, Promise<unknown>>();

/**
 * Derive a deterministic cache key from method, URL, cookie, and authorization header.
 * Used to coalesce concurrent identical GET requests into a single upstream call.
 */
function createPrivateApiCacheKey(event: H3Event) {
  const url = event.node.req.originalUrl ?? event.node.req.url ?? event.path;
  const cookie = getRequestHeader(event, 'cookie') ?? '';
  const authorization = getRequestHeader(event, 'authorization') ?? '';

  return createHash('sha256')
    .update(JSON.stringify([event.method, url, cookie, authorization]))
    .digest('hex');
}

/**
 * Set cache-control headers on a private API response to prevent public caching.
 */
export function setPrivateApiCacheControl(event: H3Event) {
  setHeader(event, 'cache-control', PRIVATE_API_CACHE_CONTROL);
}

/**
 * Define an H3 event handler that coalesces concurrent identical GET requests
 * into a single upstream call. Non-GET methods pass through immediately.
 */
export function definePrivateApiCoalescedEventHandler<T>(handler: PrivateApiHandler<T>) {
  return defineEventHandler(async (event) => {
    setPrivateApiCacheControl(event);

    // Only coalesce GET requests — writes and other methods are not deduplicated
    if (event.method !== 'GET') {
      return handler(event);
    }

    const cacheKey = createPrivateApiCacheKey(event);
    const pendingResponse = pendingPrivateApiResponses.get(cacheKey);

    if (pendingResponse) {
      return pendingResponse as Promise<T>;
    }

    const responsePromise = (async () => handler(event))().finally(() => {
      pendingPrivateApiResponses.delete(cacheKey);
    });

    pendingPrivateApiResponses.set(cacheKey, responsePromise);

    return responsePromise;
  });
}
