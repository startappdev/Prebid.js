import {
  deepAccess,
  isArray,
  isEmpty,
  isEmptyStr,
  isStr,
  logError,
  logInfo,
  safeJSONEncode,
  deepClone,
  deepSetValue, getWindowTop
} from '../src/utils.js';
import {registerBidder} from '../src/adapters/bidderFactory.js';
import {config} from '../src/config.js';
import {BANNER, NATIVE, VIDEO} from '../src/mediaTypes.js';
import {Renderer} from '../src/Renderer.js';
import { convertOrtbRequestToProprietaryNative } from '../src/native.js';
import {getGptSlotInfoForAdUnitCode} from '../libraries/gptUtils/gptUtils.js';
import {getViewportCoordinates} from '../libraries/viewport/viewport.js';
import {filterBidsListByFilters, getTopWindowReferrer} from '../libraries/medianetUtils/utils.js';
import {errorLogger} from '../libraries/medianetUtils/logger.js';
import {GLOBAL_VENDOR_ID, MEDIANET} from '../libraries/medianetUtils/constants.js';
import {getGlobal} from '../src/prebidGlobal.js';
import {getBoundingClientRect} from '../libraries/boundingClientRect/boundingClientRect.js';

/**
 * @typedef {import('../src/adapters/bidderFactory.js').BidRequest} BidRequest
 * @typedef {import('../src/adapters/bidderFactory.js').Bid} Bid
 * @typedef {import('../src/adapters/bidderFactory.js').TimedOutBid} TimedOutBid
 */

const BIDDER_CODE = MEDIANET;
const TRUSTEDSTACK_CODE = 'trustedstack';
const BID_URL = 'https://prebid.media.net/rtb/prebid';
const TRUSTEDSTACK_URL = 'https://prebid.trustedstack.com/rtb/trustedstack';
const PLAYER_URL = 'https://prebid.media.net/video/bundle.js';
const SLOT_VISIBILITY = {
  NOT_DETERMINED: 0,
  ABOVE_THE_FOLD: 1,
  BELOW_THE_FOLD: 2
};
export const EVENTS = {
  TIMEOUT_EVENT_NAME: 'client_timeout',
  BID_WON_EVENT_NAME: 'client_bid_won',
  SET_TARGETING: 'client_set_targeting',
  BIDDER_ERROR: 'client_bidder_error'
};
const OUTSTREAM = 'outstream';

let pageMeta;
let customerId;

window.mnet = window.mnet || {};
window.mnet.queue = window.mnet.queue || [];

const aliases = [
  { code: TRUSTEDSTACK_CODE, gvlid: 1288 },
];

getGlobal().medianetGlobals = getGlobal().medianetGlobals || {};

function siteDetails(site, bidderRequest) {
  const urlData = bidderRequest.refererInfo;
  site = site || {};
  const siteData = {
    domain: site.domain || urlData.domain,
    page: site.page || urlData.page,
    ref: getTopWindowReferrer(site.ref),
    topMostLocation: urlData.topmostLocation,
    isTop: site.isTop || urlData.reachedTop
  };
  if (!pageMeta) {
    pageMeta = getPageMeta();
  }
  return Object.assign(siteData, pageMeta);
}

function getPageMeta() {
  if (pageMeta) {
    return pageMeta;
  }
  const canonicalUrl = getUrlFromSelector('link[rel="canonical"]', 'href');

  pageMeta = Object.assign({},
    canonicalUrl && { 'canonical_url': canonicalUrl },
  );

  return pageMeta;
}

function getUrlFromSelector(selector, attribute) {
  const attr = getAttributeFromSelector(selector, attribute);
  return attr && getAbsoluteUrl(attr);
}

function getAttributeFromSelector(selector, attribute) {
  try {
    const doc = getWindowTop().document;
    const element = doc.querySelector(selector);
    if (element !== null && element[attribute]) {
      return element[attribute];
    }
  } catch (e) {}
}

function getAbsoluteUrl(url) {
  const aTag = getWindowTop().document.createElement('a');
  aTag.href = url;

  return aTag.href;
}

function transformSizes(sizes) {
  if (isArray(sizes) && sizes.length === 2 && !isArray(sizes[0])) {
    return [getSize(sizes)];
  }

  return sizes.map(size => getSize(size))
}

function getSize(size) {
  return {
    w: parseInt(size[0], 10),
    h: parseInt(size[1], 10)
  }
}

function getWindowSize() {
  return {
    w: window.screen.width || -1,
    h: window.screen.height || -1
  }
}

function getCoordinates(adUnitCode) {
  let element = document.getElementById(adUnitCode);
  if (!element && adUnitCode.indexOf('/') !== -1) {
    // now it means that adUnitCode is GAM AdUnitPath
    const {divId} = getGptSlotInfoForAdUnitCode(adUnitCode);
    if (isStr(divId)) {
      element = document.getElementById(divId);
    }
  }
  if (element) {
    const rect = getBoundingClientRect(element);
    const coordinates = {};
    coordinates.top_left = {
      y: rect.top,
      x: rect.left
    };
    coordinates.bottom_right = {
      y: rect.bottom,
      x: rect.right
    };
    return coordinates
  }
  return null;
}

function extParams(bidRequest, bidderRequests) {
  const params = deepAccess(bidRequest, 'params');
  const gdpr = deepAccess(bidderRequests, 'gdprConsent');
  const uspConsent = deepAccess(bidderRequests, 'uspConsent');
  const userId = deepAccess(bidRequest, 'userId');
  const sChain = deepAccess(bidRequest, 'ortb2.source.ext.schain') || {};
  const windowSize = spec.getWindowSize();
  const gdprApplies = !!(gdpr && gdpr.gdprApplies);
  const uspApplies = !!(uspConsent);
  const coppaApplies = !!(config.getConfig('coppa'));
  const {top = -1, right = -1, bottom = -1, left = -1} = getViewportCoordinates();
  return Object.assign({},
    { customer_id: params.cid },
    { prebid_version: 'v' + '$prebid.version$' },
    { gdpr_applies: gdprApplies },
    (gdprApplies) && { gdpr_consent_string: gdpr.consentString || '' },
    { usp_applies: uspApplies },
    uspApplies && { usp_consent_string: uspConsent || '' },
    {coppa_applies: coppaApplies},
    windowSize.w !== -1 && windowSize.h !== -1 && { screen: windowSize },
    userId && { user_id: userId },
    getGlobal().medianetGlobals.analyticsEnabled && { analytics: true },
    !isEmpty(sChain) && {schain: sChain},
    {
      vcoords: {
        top_left: { x: left, y: top },
        bottom_right: { x: right, y: bottom }
      }
    }
  );
}

function slotParams(bidRequest, bidderRequests) {
  // check with Media.net Account manager for  bid floor and crid parameters
  const slotInfo = getGptSlotInfoForAdUnitCode(bidRequest.adUnitCode);
  const params = {
    id: bidRequest.bidId,
    transactionId: bidRequest.ortb2Imp?.ext?.tid,
    ext: {
      dfp_id: bidRequest.adUnitCode,
      display_count: bidRequest.auctionsCount,
      adUnitCode: bidRequest.adUnitCode,
      divId: slotInfo.divId,
      adUnitPath: slotInfo.gptSlot
    },
    all: bidRequest.params
  };

  if (bidRequest.ortb2Imp) {
    params.ortb2Imp = bidRequest.ortb2Imp;
  }

  const bannerSizes = deepAccess(bidRequest, 'mediaTypes.banner.sizes') || [];

  const videoInMediaType = deepAccess(bidRequest, 'mediaTypes.video') || {};
  const videoInParams = deepAccess(bidRequest, 'params.video') || {};
  const videoCombinedObj = Object.assign({}, videoInParams, videoInMediaType);

  if (!isEmpty(videoCombinedObj)) {
    params.video = videoCombinedObj;
  }

  if (bannerSizes.length > 0) {
    params.banner = transformSizes(bannerSizes);
  }
  if (bidRequest.nativeParams) {
    try {
      params.native = JSON.stringify(bidRequest.nativeParams);
    } catch (e) {
      logError((`${BIDDER_CODE} : Incorrect JSON : bidRequest.nativeParams`));
    }
  }

  if (bidRequest.params.crid) {
    params.tagid = bidRequest.params.crid.toString();
  }

  const bidFloor = parseFloat(bidRequest.params.bidfloor || bidRequest.params.bidFloor);
  if (bidFloor) {
    params.bidfloor = bidFloor;
  }
  const coordinates = getCoordinates(bidRequest.adUnitCode);
  if (coordinates && params.banner && params.banner.length !== 0) {
    const normCoordinates = normalizeCoordinates(coordinates);
    params.ext.coordinates = normCoordinates;
    params.ext.viewability = getSlotVisibility(coordinates.top_left, getMinSize(params.banner));
    if (getSlotVisibility(normCoordinates.top_left, getMinSize(params.banner)) > 0.5) {
      params.ext.visibility = SLOT_VISIBILITY.ABOVE_THE_FOLD;
    } else {
      params.ext.visibility = SLOT_VISIBILITY.BELOW_THE_FOLD;
    }
  } else {
    params.ext.visibility = SLOT_VISIBILITY.NOT_DETERMINED;
  }
  const floorInfo = getBidFloorByType(bidRequest);
  if (floorInfo && floorInfo.length > 0) {
    params.bidfloors = floorInfo;
  }
  if (bidderRequests.paapi?.enabled) {
    params.ext.ae = bidRequest?.ortb2Imp?.ext?.ae;
  }
  return params;
}

function getBidFloorByType(bidRequest) {
  const floorInfo = [];
  if (typeof bidRequest.getFloor === 'function') {
    [BANNER, VIDEO, NATIVE].forEach(mediaType => {
      if (bidRequest.mediaTypes.hasOwnProperty(mediaType)) {
        if (mediaType === BANNER) {
          bidRequest.mediaTypes.banner.sizes.forEach(
            size => {
              setFloorInfo(bidRequest, mediaType, size, floorInfo)
            }
          )
        } else {
          setFloorInfo(bidRequest, mediaType, '*', floorInfo)
        }
      }
    });
  }
  return floorInfo;
}
function setFloorInfo(bidRequest, mediaType, size, floorInfo) {
  const floor = bidRequest.getFloor({currency: 'USD', mediaType: mediaType, size: size}) || {};
  if (size.length > 1) floor.size = size;
  floor.mediaType = mediaType;
  floorInfo.push(floor);
}
function getMinSize(sizes) {
  return sizes.reduce((min, size) => size.h * size.w < min.h * min.w ? size : min);
}

function getSlotVisibility(topLeft, size) {
  const maxArea = size.w * size.h;
  const windowSize = spec.getWindowSize();
  const bottomRight = {
    x: topLeft.x + size.w,
    y: topLeft.y + size.h
  };
  if (maxArea === 0 || windowSize.w === -1 || windowSize.h === -1) {
    return 0;
  }

  return getOverlapArea(topLeft, bottomRight, {x: 0, y: 0}, {x: windowSize.w, y: windowSize.h}) / maxArea;
}

// find the overlapping area between two rectangles
function getOverlapArea(topLeft1, bottomRight1, topLeft2, bottomRight2) {
  // If no overlap, return 0
  if ((topLeft1.x > bottomRight2.x || bottomRight1.x < topLeft2.x) || (topLeft1.y > bottomRight2.y || bottomRight1.y < topLeft2.y)) {
    return 0;
  }
  // return overlapping area : [ min of rightmost/bottommost co-ordinates ] - [ max of leftmost/topmost co-ordinates ]
  return ((Math.min(bottomRight1.x, bottomRight2.x) - Math.max(topLeft1.x, topLeft2.x)) * (Math.min(bottomRight1.y, bottomRight2.y) - Math.max(topLeft1.y, topLeft2.y)));
}

function normalizeCoordinates(coordinates) {
  const {scrollX, scrollY} = window;
  return {
    top_left: {
      x: coordinates.top_left.x + scrollX,
      y: coordinates.top_left.y + scrollY,
    },
    bottom_right: {
      x: coordinates.bottom_right.x + scrollX,
      y: coordinates.bottom_right.y + scrollY,
    }
  }
}

function getBidderURL(bidderCode, cid) {
  const url = (bidderCode === TRUSTEDSTACK_CODE) ? TRUSTEDSTACK_URL : BID_URL;
  return url + '?cid=' + encodeURIComponent(cid);
}

function ortb2Data(ortb2, bidRequests) {
  const ortb2Object = deepClone(ortb2);
  const eids = deepAccess(bidRequests, '0.userIdAsEids');
  if (eids) {
    deepSetValue(ortb2Object, 'user.ext.eids', eids)
  }
  return ortb2Object;
}

function generatePayload(bidRequests, bidderRequests) {
  return {
    site: siteDetails(bidRequests[0].params.site, bidderRequests),
    ext: extParams(bidRequests[0], bidderRequests),
    // TODO: fix auctionId leak: https://github.com/prebid/Prebid.js/issues/9781
    id: bidRequests[0].auctionId,
    imp: bidRequests.map(request => slotParams(request, bidderRequests)),
    ortb2: ortb2Data(bidderRequests.ortb2, bidRequests),
    tmax: bidderRequests.timeout
  }
}

function isValidBid(bid) {
  return bid.no_bid === false && parseFloat(bid.cpm) > 0.0;
}

function fetchCookieSyncUrls(response) {
  if (!isEmpty(response) && response[0].body &&
    response[0].body.ext && isArray(response[0].body.ext.csUrl)) {
    return response[0].body.ext.csUrl;
  }

  return [];
}

function getBidData(bid) {
  const params = {};
  params.acid = bid.auctionId || '';
  params.crid = deepAccess(bid, 'params.crid') || deepAccess(bid, 'params.0.crid') || bid.adUnitCode || '';
  params.ext = safeJSONEncode(bid.ext) || '';

  const rawobj = deepClone(bid);
  delete rawobj.ad;
  delete rawobj.vastXml;
  params.rawobj = safeJSONEncode(rawobj);
  return params;
}

function getLoggingData(bids) {
  const logData = {};
  if (!isArray(bids)) {
    bids = [];
  }
  bids.forEach((bid) => {
    const bidData = getBidData(bid);
    Object.keys(bidData).forEach((key) => {
      logData[key] = logData[key] || [];
      logData[key].push(encodeURIComponent(bidData[key]));
    });
  });
  return logData;
}

function logEvent(event, data) {
  const logData = getLoggingData(data);
  event.cid = customerId;
  errorLogger(event, logData, false).send();
}

function clearPageMeta() {
  pageMeta = undefined;
}

function addRenderer(bid) {
  const videoContext = deepAccess(bid, 'context') || '';
  const vastTimeout = deepAccess(bid, 'vto');
  /* Adding renderer only when the context is Outstream
     and the provider has responded with a renderer.
   */
  if (videoContext === OUTSTREAM && vastTimeout) {
    bid.renderer = newVideoRenderer(bid);
  }
}

function newVideoRenderer(bid) {
  const renderer = Renderer.install({
    url: PLAYER_URL,
  });
  renderer.setRender(function (bid) {
    window.mnet.queue.push(function () {
      const obj = {
        width: bid.width,
        height: bid.height,
        vastTimeout: bid.vto,
        maxAllowedVastTagRedirects: bid.mavtr,
        allowVpaid: bid.avp,
        autoPlay: bid.ap,
        preload: bid.pl,
        mute: bid.mt
      }
      const adUnitCode = bid.dfp_id;
      const divId = getGptSlotInfoForAdUnitCode(adUnitCode).divId || adUnitCode;
      window.mnet.mediaNetoutstreamPlayer(bid, divId, obj);
    });
  });
  return renderer;
}
export const spec = {

  code: BIDDER_CODE,
  gvlid: GLOBAL_VENDOR_ID,
  aliases,
  supportedMediaTypes: [BANNER, NATIVE, VIDEO],

  /**
   * Determines whether or not the given bid request is valid.
   *
   * @param {object} bid The bid to validate.
   * @return boolean True if this is a valid bid (if cid is present), and false otherwise.
   */
  isBidRequestValid: function(bid) {
    if (!bid.params) {
      logError(`${BIDDER_CODE} : Missing bid parameters`);
      return false;
    }

    if (!bid.params.cid || !isStr(bid.params.cid) || isEmptyStr(bid.params.cid)) {
      logError(`${BIDDER_CODE} : cid should be a string`);
      return false;
    }
    customerId = bid.params.cid;
    return true;
  },

  /**
   * Make a server request from the list of BidRequests.
   *
   * @param {Array} bidRequests A non-empty list of bid requests which should be sent to the Server.
   * @param {Object} bidderRequests
   * @return {Object} Info describing the request to the server.
   */
  buildRequests: function(bidRequests, bidderRequests) {
    // convert Native ORTB definition to old-style prebid native definition
    bidRequests = convertOrtbRequestToProprietaryNative(bidRequests);

    const payload = generatePayload(bidRequests, bidderRequests);
    return {
      method: 'POST',
      url: getBidderURL(bidderRequests.bidderCode, payload.ext.customer_id),
      data: JSON.stringify(payload)
    };
  },

  /**
   * Unpack the response from the server into a list of bids.
   *
   * @param {*} serverResponse A successful response from the server.
   * @returns {{bids: *[], fledgeAuctionConfigs: *[]} | *[]} An object containing bids and fledgeAuctionConfigs if present, otherwise an array of bids.
   */
  interpretResponse: function(serverResponse, request) {
    let validBids = [];
    if (!serverResponse || !serverResponse.body) {
      logInfo(`${BIDDER_CODE} : response is empty`);
      return validBids;
    }
    const bids = serverResponse.body.bidList;
    if (!isArray(bids) || bids.length === 0) {
      logInfo(`${BIDDER_CODE} : no bids`);
    } else {
      validBids = bids.filter(bid => isValidBid(bid));
      validBids.forEach(addRenderer);
    }
    const fledgeAuctionConfigs = deepAccess(serverResponse, 'body.ext.paApiAuctionConfigs') || [];
    const ortbAuctionConfigs = deepAccess(serverResponse, 'body.ext.igi') || [];
    if (fledgeAuctionConfigs.length === 0 && ortbAuctionConfigs.length === 0) {
      return validBids;
    }
    if (ortbAuctionConfigs.length > 0) {
      fledgeAuctionConfigs.push(...ortbAuctionConfigs.map(({igs}) => igs || []).flat());
    }
    return {
      bids: validBids,
      paapi: fledgeAuctionConfigs,
    }
  },
  getUserSyncs: function(syncOptions, serverResponses) {
    const cookieSyncUrls = fetchCookieSyncUrls(serverResponses);

    if (syncOptions.iframeEnabled) {
      return filterBidsListByFilters(cookieSyncUrls, {type: 'iframe'});
    }

    if (syncOptions.pixelEnabled) {
      return filterBidsListByFilters(cookieSyncUrls, {type: 'image'});
    }
  },

  /**
   * @param {TimedOutBid} timeoutData
   */
  onTimeout: (timeoutData) => {
    try {
      const eventData = {
        name: EVENTS.TIMEOUT_EVENT_NAME,
        value: timeoutData.length,
        relatedData: timeoutData[0].timeout || config.getConfig('bidderTimeout')
      };
      logEvent(eventData, timeoutData);
    } catch (e) {}
  },

  /**
   * @param {Bid} bid
   */
  onBidWon: (bid) => {
    try {
      const eventData = {
        name: EVENTS.BID_WON_EVENT_NAME,
        value: bid.cpm
      };
      logEvent(eventData, [bid]);
    } catch (e) {}
  },

  onSetTargeting: (bid) => {
    try {
      const eventData = {
        name: EVENTS.SET_TARGETING,
        value: bid.cpm
      };
      const enableSendAllBids = config.getConfig('enableSendAllBids');
      if (!enableSendAllBids) {
        logEvent(eventData, [bid]);
      }
    } catch (e) {}
  },

  onBidderError: ({error, bidderRequest}) => {
    try {
      const eventData = {
        name: EVENTS.BIDDER_ERROR,
        relatedData: `timedOut:${error.timedOut}|status:${error.status}|message:${error.reason.message}`
      };
      logEvent(eventData, bidderRequest.bids);
    } catch (e) {}
  },

  clearPageMeta,

  getWindowSize,
};
registerBidder(spec);
