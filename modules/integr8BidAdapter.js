import { deepAccess, isFn, isPlainObject } from '../src/utils.js';
import { registerBidder } from '../src/adapters/bidderFactory.js';
import { getStorageManager } from '../src/storageManager.js';
import { BANNER, VIDEO } from '../src/mediaTypes.js';

/**
 * @typedef {import('../src/adapters/bidderFactory.js').BidRequest} BidRequest
 * @typedef {import('../src/adapters/bidderFactory.js').Bid} Bid
 * @typedef {import('../src/adapters/bidderFactory.js').ServerResponse} ServerResponse
 * @typedef {import('../src/adapters/bidderFactory.js').validBidRequests} validBidRequests
 */

const BIDDER_CODE = 'integr8';
const DEFAULT_ENDPOINT_URL = 'https://central.sea.integr8.digital/bid';
const DIMENSION_SEPARATOR = 'x';
const SIZE_SEPARATOR = ';';
const BISKO_ID = 'integr8Id';
const STORAGE_ID = 'bisko-sid';
const SEGMENTS = 'integr8Segments';
const storage = getStorageManager({bidderCode: BIDDER_CODE});

export const spec = {
  code: BIDDER_CODE,
  supportedMediaTypes: [BANNER, VIDEO],
  /**
   * Determines whether or not the given bid request is valid.
   *
   * @param {BidRequest} bid The bid params to validate.
   * @return boolean True if this is a valid bid, and false otherwise.
   */
  isBidRequestValid: function (bid) {
    return !!(bid.params && bid.params.propertyId && bid.params.placementId);
  },
  /**
   * Make a server request from the list of BidRequests.
   *
   * @param {Array} validBidRequests - an array of bids
   * @param {Object} bidderRequest
   * @return {Object} Info describing the request to the server.
   */
  buildRequests: function (validBidRequests, bidderRequest) {
    let deliveryUrl = '';
    const storageId = storage.localStorageIsEnabled() ? storage.getDataFromLocalStorage(STORAGE_ID) || '' : '';
    const biskoId = storage.localStorageIsEnabled() ? storage.getDataFromLocalStorage(BISKO_ID) || '' : '';
    const segments = storage.localStorageIsEnabled() ? JSON.parse(storage.getDataFromLocalStorage(SEGMENTS)) || [] : [];

    let propertyId = '';
    let pageViewGuid = '';
    let bidderRequestId = '';
    let url = '';
    let contents = [];
    let data = {};

    if (bidderRequest) {
      bidderRequestId = bidderRequest.bidderRequestId;

      if (bidderRequest.refererInfo) {
        url = bidderRequest.refererInfo.page;
      }
    }

    const placements = validBidRequests.map(bidRequest => {
      if (!propertyId) { propertyId = bidRequest.params.propertyId; }
      if (!pageViewGuid) { pageViewGuid = bidRequest.params.pageViewGuid || ''; }
      if (!contents.length && bidRequest.params.contents && bidRequest.params.contents.length) { contents = bidRequest.params.contents; }
      if (!Object.keys(data).length && bidRequest.params.data && Object.keys(bidRequest.params.data).length) { data = bidRequest.params.data; }
      if (!deliveryUrl && bidRequest.params && typeof bidRequest.params.deliveryUrl === 'string') {
        deliveryUrl = bidRequest.params.deliveryUrl;
      }

      return {
        sizes: generateSizeParam(bidRequest.sizes),
        adUnitId: bidRequest.adUnitCode,
        placementId: bidRequest.params.placementId,
        bidid: bidRequest.bidId,
        count: bidRequest.params.count,
        skipTime: deepAccess(bidRequest, 'mediaTypes.video.skipafter', bidRequest.params.skipTime),
        floor: getBidFloor(bidRequest)
      };
    });

    if (!deliveryUrl) {
      deliveryUrl = DEFAULT_ENDPOINT_URL;
    }

    const body = {
      propertyId: propertyId,
      pageViewGuid: pageViewGuid,
      storageId: storageId,
      biskoId: biskoId,
      segments: segments,
      url: url,
      requestid: bidderRequestId,
      placements: placements,
      contents: contents,
      data: data
    };

    return [{
      method: 'POST',
      url: deliveryUrl,
      data: body
    }];
  },
  /**
   * Unpack the response from the server into a list of bids.
   *
   * @param {ServerResponse} serverResponse A successful response from the server.
   * @return {Bid[]} An array of bids which were nested inside the server.
   */
  interpretResponse: function (serverResponse) {
    const responses = serverResponse.body;
    const bidResponses = [];
    for (var i = 0; i < responses.length; i++) {
      const bidResponse = {
        requestId: responses[i].BidId,
        cpm: responses[i].CPM,
        width: responses[i].Width,
        height: responses[i].Height,
        creativeId: responses[i].CreativeId,
        currency: responses[i].Currency,
        netRevenue: responses[i].NetRevenue,
        ttl: responses[i].TTL,
        referrer: responses[i].Referrer,
        ad: responses[i].Ad,
        vastUrl: responses[i].VastUrl,
        mediaType: responses[i].MediaType,
        meta: {
          advertiserDomains: Array.isArray(responses[i].ADomain) ? responses[i].ADomain : []
        }
      };
      bidResponses.push(bidResponse);
    }
    return bidResponses;
  }
};

/**
 * Generate size param for bid request using sizes array
 *
 * @param {Array} sizes Possible sizes for the ad unit.
 * @return {string} Processed sizes param to be used for the bid request.
 */
function generateSizeParam(sizes) {
  return sizes.map(size => size.join(DIMENSION_SEPARATOR)).join(SIZE_SEPARATOR);
}

export function getBidFloor(bid) {
  if (!isFn(bid.getFloor)) {
    return null;
  }

  const floor = bid.getFloor({
    currency: 'EUR',
    mediaType: '*',
    size: '*'
  });

  if (isPlainObject(floor) && !isNaN(floor.floor) && floor.currency === 'EUR') {
    return floor.floor;
  }

  return null;
}

registerBidder(spec);
