import {oxxionSubmodule} from 'modules/oxxionRtdProvider.js';
import 'src/prebid.js';

const utils = require('src/utils.js');

const moduleConfig = {
  params: {
    domain: 'test.endpoint',
    contexts: ['instream', 'outstream'],
    samplingRate: 10,
    threshold: false,
    bidders: ['appnexus', 'mediasquare'],
  }
};

const request = {
  'auctionId': '1e8b993d-8f0a-4232-83eb-3639ddf3a44b',
  'timestamp': 1647424261187,
  'auctionEnd': 1647424261714,
  'auctionStatus': 'completed',
  'adUnits': [
    {
      'code': 'msq_tag_200124_banner',
      'mediaTypes': { 'banner': { 'sizes': [[300, 600]] } },
      'bids': [{'bidder': 'appnexus', 'params': {'placementId': 123456}}],
      'transactionId': 'de664ccb-e18b-4436-aeb0-362382eb1b40'
    },
    {
      'code': 'msq_tag_200125_video',
      'mediaTypes': { 'video': { 'context': 'instream' }, playerSize: [640, 480], mimes: ['video/mp4'] },
      'bids': [
        {'bidder': 'mediasquare', 'params': {'code': 'publishername_atf_desktop_rg_video', 'owner': 'test'}},
        {'bidder': 'appnexusAst', 'params': {'placementId': 345678}},
      ],
      'transactionId': 'de664ccb-e18b-4436-aeb0-362382eb1b41'
    },
    {
      'code': 'msq_tag_200125_banner',
      'mediaTypes': { 'banner': { 'sizes': [[300, 250]] } },
      'bids': [
        {'bidder': 'appnexusAst', 'params': {'placementId': 345678}},
      ],
      'transactionId': 'de664ccb-e18b-4436-aeb0-362382eb1b41'
    }
  ]
};

const bids = [{
  'bidderCode': 'mediasquare',
  'width': 640,
  'height': 480,
  'statusMessage': 'Bid available',
  'adId': '3647626fdbe68a',
  'requestId': '2d891705d2125b',
  'transactionId': 'de664ccb-e18b-4436-aeb0-362382eb1b41',
  'auctionId': '1e8b993d-8f0a-4232-83eb-3639ddf3a44b',
  'mediaType': 'video',
  'source': 'client',
  'cpm': 0.9723,
  'creativeId': 'freewheel|AdswizzAd71819',
  'currency': 'USD',
  'netRevenue': true,
  'ttl': 2000,
  'mediasquare': {
    'bidder': 'freewheel',
    'code': 'test/publishername_atf_desktop_rg_video',
    'hasConsent': true
  },
  'meta': {
    'advertiserDomains': [
      'unknown'
    ]
  },
  'vastUrl': 'https://some.vast-url.com',
  'vastXml': '<VAST version="3.0"><Ad><Wrapper><VASTAdTagURI><![CDATA[https://pbs-front.mediasquare.fr/cache?uuid=4de68767e8f2f9974fd4addd5a9d135a]]></VASTAdTagURI><Impression><![CDATA[https://pbs-front.mediasquare.fr/winning?adUnitCode=&auctionId=ZltsQnBqbcyC6aalwAdD4irnXmrl3E&bidder=freewheel&code=test/publishername_atf_desktop_rg_video&cpm=0.9723&creativeId=AdswizzAd71819&currency=USD&hasConsent=true&mediaType=video&pbjs=&requestId=2d891705d2125b&size=video&timeToRespond=unknown]]></Impression></Wrapper></Ad></VAST>',
  'adapterCode': 'mediasquare',
  'originalCpm': 0.9723,
  'originalCurrency': 'USD',
  'responseTimestamp': 1665505150740,
  'requestTimestamp': 1665505150594,
  'bidder': 'mediasquare',
  'adUnitCode': 'msq_tag_200125_video',
  'timeToRespond': 146,
  'size': '640x480',
}, {
  'bidderCode': 'appnexusAst',
  'width': 640,
  'height': 480,
  'statusMessage': 'Bid available',
  'adId': '4b2e1581c0ca1a',
  'requestId': '2d891705d2125b',
  'transactionId': 'de664ccb-e18b-4436-aeb0-362382eb1b41',
  'auctionId': '1e8b993d-8f0a-4232-83eb-3639ddf3a44b',
  'mediaType': 'video',
  'source': 'client',
  'cpm': 1.9723,
  'creativeId': '159080650',
  'currency': 'USD',
  'netRevenue': true,
  'ttl': 2000,
  'vastUrl': 'https://some.vast-url.com',
  'vastXml': '<VAST version="3.0"><Ad><InLine><AdSystem>Adnxs</AdSystem><AdTitle>Title</AdTitle><Creatives/></InLine></Ad></VAST>',
  'adapterCode': 'mediasquare',
  'originalCpm': 1.9723,
  'originalCurrency': 'USD',
  'responseTimestamp': 1665505150740,
  'requestTimestamp': 1665505150594,
  'bidder': 'appnexusAst',
  'adUnitCode': 'msq_tag_200125_video',
  'timeToRespond': 146,
  'size': '640x480',
  'vastImpUrl': 'https://some.tracking-url.com'
},
];

const bidInterests = [
  {'id': 0, 'rate': 50.0, 'suggestion': true},
  {'id': 1, 'rate': 12.0, 'suggestion': false},
  {'id': 2, 'rate': 0.0, 'suggestion': true},
  {'id': 3, 'rate': 0.0, 'suggestion': false},
];

const userConsent = {
  'gdpr': {
    'consentString': 'consent_hash'
  },
  'usp': null,
  'gpp': null,
  'coppa': false
};

describe('oxxionRtdProvider', () => {
  describe('Oxxion RTD sub module', () => {
    it('should init, return true, and set the params', () => {
      expect(oxxionSubmodule.init(moduleConfig)).to.equal(true);
    });
  });

  describe('Oxxion RTD sub module', () => {
    const auctionEnd = request;
    auctionEnd.bidsReceived = bids;
    it('call everything', function() {
      oxxionSubmodule.getBidRequestData(request, null, moduleConfig);
    });
    it('check bid filtering', function() {
      const requestsList = oxxionSubmodule.getRequestsList(request);
      expect(requestsList.length).to.equal(4);
      expect(requestsList[0]).to.have.property('id');
      expect(request.adUnits[0].bids[0]).to.have.property('_id');
      expect(requestsList[0].id).to.equal(request.adUnits[0].bids[0]._id);
      const [filteredBiddderRequests, filteredBids] = oxxionSubmodule.getFilteredAdUnitsOnBidRates(bidInterests, request.adUnits, moduleConfig.params, false);
      expect(filteredBids.length).to.equal(1);
      expect(filteredBiddderRequests.length).to.equal(3);
      expect(filteredBiddderRequests[0]).to.have.property('bids');
      expect(filteredBiddderRequests[0].bids.length).to.equal(1);
      expect(filteredBiddderRequests[1]).to.have.property('bids');
      expect(filteredBiddderRequests[1].bids.length).to.equal(1);
    });
  });
});
