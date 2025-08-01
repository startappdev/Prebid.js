import { parseSizesInput, uniques, buildUrl, logError } from '../src/utils.js';
import { ajax } from '../src/ajax.js';
import adapter from '../libraries/analyticsAdapter/AnalyticsAdapter.js';
import adapterManager from '../src/adapterManager.js';
import { EVENTS } from '../src/constants.js';

/**
 * Analytics adapter from adxcg.com
 * maintainer info@adxcg.com
 * updated 201911 for prebid 3.0
 */

const emptyUrl = '';
const analyticsType = 'endpoint';
const adxcgAnalyticsVersion = 'v2.01';

var adxcgAnalyticsAdapter = Object.assign(adapter(
  {
    emptyUrl,
    analyticsType
  }), {
  track ({eventType, args}) {
    switch (eventType) {
      case EVENTS.AUCTION_INIT:
        adxcgAnalyticsAdapter.context.events.auctionInit = mapAuctionInit(args);
        adxcgAnalyticsAdapter.context.auctionTimestamp = args.timestamp;
        break;
      case EVENTS.BID_REQUESTED:
        adxcgAnalyticsAdapter.context.auctionId = args.auctionId;
        adxcgAnalyticsAdapter.context.events.bidRequests.push(mapBidRequested(args));
        break;
      case EVENTS.BID_ADJUSTMENT:
        break;
      case EVENTS.BID_TIMEOUT:
        adxcgAnalyticsAdapter.context.events.bidTimeout = args.map(item => item.bidder).filter(uniques);
        break;
      case EVENTS.BIDDER_DONE:
        break;
      case EVENTS.BID_RESPONSE:
        adxcgAnalyticsAdapter.context.events.bidResponses.push(mapBidResponse(args, eventType));
        break;
      case EVENTS.BID_WON:
        const outData2 = {bidWons: mapBidWon(args)};
        send(outData2);
        break;
      case EVENTS.AUCTION_END:
        send(adxcgAnalyticsAdapter.context.events);
        break;
    }
  }

});

function mapAuctionInit (auctionInit) {
  return {
    timeout: auctionInit.timeout
  };
}

function mapBidRequested (bidRequests) {
  return {
    bidderCode: bidRequests.bidderCode,
    time: bidRequests.start,
    bids: bidRequests.bids.map(function (bid) {
      return {
        transactionId: bid.transactionId,
        adUnitCode: bid.adUnitCode,
        bidId: bid.bidId,
        start: bid.startTime,
        sizes: parseSizesInput(bid.sizes).toString(),
        params: bid.params
      };
    }),
  };
}

function mapBidResponse (bidResponse, eventType) {
  return {
    bidderCode: bidResponse.bidder,
    transactionId: bidResponse.transactionId,
    adUnitCode: bidResponse.adUnitCode,
    statusMessage: bidResponse.statusMessage,
    mediaType: bidResponse.mediaType,
    renderedSize: bidResponse.size,
    cpm: bidResponse.cpm,
    currency: bidResponse.currency,
    netRevenue: bidResponse.netRevenue,
    timeToRespond: bidResponse.timeToRespond,
    bidId: eventType === EVENTS.BID_TIMEOUT ? bidResponse.bidId : bidResponse.requestId,
    dealId: bidResponse.dealId,
    status: bidResponse.status,
    creativeId: bidResponse.creativeId.toString()
  };
}

function mapBidWon (bidResponse) {
  return [{
    bidderCode: bidResponse.bidder,
    adUnitCode: bidResponse.adUnitCode,
    statusMessage: bidResponse.statusMessage,
    mediaType: bidResponse.mediaType,
    renderedSize: bidResponse.size,
    cpm: bidResponse.cpm,
    currency: bidResponse.currency,
    netRevenue: bidResponse.netRevenue,
    timeToRespond: bidResponse.timeToRespond,
    bidId: bidResponse.requestId,
    dealId: bidResponse.dealId,
    status: bidResponse.status,
    creativeId: bidResponse.creativeId.toString()
  }];
}

function send (data) {
  const adxcgAnalyticsRequestUrl = buildUrl({
    protocol: 'https',
    hostname: adxcgAnalyticsAdapter.context.host,
    pathname: '/pbrx/v2',
    search: {
      pid: adxcgAnalyticsAdapter.context.initOptions.publisherId,
      aid: adxcgAnalyticsAdapter.context.auctionId,
      ats: adxcgAnalyticsAdapter.context.auctionTimestamp,
      aav: adxcgAnalyticsVersion,
      iob: intersectionObserverAvailable(window) ? '1' : '0',
      pbv: '$prebid.version$',
      sz: window.screen.width + 'x' + window.screen.height
    }
  });

  ajax(adxcgAnalyticsRequestUrl, undefined, JSON.stringify(data), {
    contentType: 'text/plain',
    method: 'POST',
    withCredentials: true
  });
}

function intersectionObserverAvailable (win) {
  return win && win.IntersectionObserver && win.IntersectionObserverEntry &&
    win.IntersectionObserverEntry.prototype && 'intersectionRatio' in win.IntersectionObserverEntry.prototype;
}

adxcgAnalyticsAdapter.context = {};
adxcgAnalyticsAdapter.originEnableAnalytics = adxcgAnalyticsAdapter.enableAnalytics;
adxcgAnalyticsAdapter.enableAnalytics = function (config) {
  if (!config.options.publisherId) {
    logError('PublisherId option is not defined. Analytics won\'t work');
    return;
  }

  adxcgAnalyticsAdapter.context = {
    events: {
      bidRequests: [],
      bidResponses: []
    },
    initOptions: config.options,
    host: config.options.host || ('hbarxs.adxcg.net')
  };

  adxcgAnalyticsAdapter.originEnableAnalytics(config);
};

adapterManager.registerAnalyticsAdapter({
  adapter: adxcgAnalyticsAdapter,
  code: 'adxcg'
});

export default adxcgAnalyticsAdapter;
