import { liveIntentExternalIdSubmodule, resetSubmodule } from 'libraries/liveIntentId/externalIdSystem.js';
import { DEFAULT_TREATMENT_RATE } from 'libraries/liveIntentId/shared.js';
import { gdprDataHandler, uspDataHandler, gppDataHandler, coppaDataHandler } from '../../../src/adapterManager.js';
import * as refererDetection from '../../../src/refererDetection.js';
const DEFAULT_AJAX_TIMEOUT = 5000
const PUBLISHER_ID = '89899';
const defaultConfigParams = { params: {publisherId: PUBLISHER_ID, fireEventDelay: 1} };

describe('LiveIntentExternalId', function() {
  let uspConsentDataStub;
  let gdprConsentDataStub;
  let gppConsentDataStub;
  let coppaConsentDataStub;
  let refererInfoStub;
  let randomStub;

  beforeEach(function() {
    uspConsentDataStub = sinon.stub(uspDataHandler, 'getConsentData');
    gdprConsentDataStub = sinon.stub(gdprDataHandler, 'getConsentData');
    gppConsentDataStub = sinon.stub(gppDataHandler, 'getConsentData');
    coppaConsentDataStub = sinon.stub(coppaDataHandler, 'getCoppa');
    refererInfoStub = sinon.stub(refererDetection, 'getRefererInfo');
    randomStub = sinon.stub(Math, 'random').returns(0.6);
  });

  afterEach(function() {
    uspConsentDataStub?.restore();
    gdprConsentDataStub?.restore();
    gppConsentDataStub?.restore();
    coppaConsentDataStub?.restore();
    refererInfoStub?.restore();
    randomStub?.restore();
    window.liQHub = []; // reset
    window.liModuleEnabled = undefined; // reset
    window.liTreatmentRate = undefined; // reset
    resetSubmodule();
  });

  it('should use appId in integration when both appId and distributorId are provided', function() {
    const configParams = {
      params: {
        ...defaultConfigParams.params,
        distributorId: 'did-1111',
        liCollectConfig: {
          appId: 'a-0001'
        },
        emailHash: '123'
      }
    }
    liveIntentExternalIdSubmodule.decode({}, configParams);
    expect(window.liQHub).to.eql([{
      clientDetails: { name: 'prebid', version: '$prebid.version$' },
      clientRef: {},
      collectSettings: { timeout: DEFAULT_AJAX_TIMEOUT },
      consent: {},
      integration: { appId: 'a-0001', publisherId: '89899', type: 'application' },
      partnerCookies: new Set(),
      resolveSettings: { identityPartner: 'prebid', timeout: DEFAULT_AJAX_TIMEOUT },
      type: 'register_client'
    },
    {
      clientRef: {},
      sourceEvent: { emailHash: '123' },
      type: 'collect'
    }])
  });

  it('should fire an event and resolve when getId and include the privacy settings into the resolution request', function () {
    uspConsentDataStub.returns('1YNY');
    gdprConsentDataStub.returns({
      gdprApplies: true,
      consentString: 'consentDataString'
    })
    gppConsentDataStub.returns({
      gppString: 'gppConsentDataString',
      applicableSections: [1, 2]
    })
    liveIntentExternalIdSubmodule.getId(defaultConfigParams).callback(() => {});

    const expectedConsent = { gdpr: { consentString: 'consentDataString', gdprApplies: true }, gpp: { applicableSections: [1, 2], consentString: 'gppConsentDataString' }, usPrivacy: { consentString: '1YNY' } }

    expect(window.liQHub).to.have.length(2)

    expect(window.liQHub[0]).to.eql({
      clientDetails: { name: 'prebid', version: '$prebid.version$' },
      clientRef: {},
      collectSettings: { timeout: DEFAULT_AJAX_TIMEOUT },
      consent: expectedConsent,
      integration: { distributorId: defaultConfigParams.distributorId, publisherId: '89899', type: 'custom' },
      partnerCookies: new Set(),
      resolveSettings: { identityPartner: 'prebid', timeout: DEFAULT_AJAX_TIMEOUT },
      type: 'register_client'
    })

    const resolveCommand = window.liQHub[1]
    // functions cannot be reasonably compared, remove them
    delete resolveCommand.onSuccess[0].callback
    delete resolveCommand.onFailure

    expect(resolveCommand).to.eql({
      clientRef: {},
      onSuccess: [{ type: 'callback' }],
      requestedAttributes: [ 'nonId' ],
      type: 'resolve'
    })
  });

  it('should fire an event when getId and a hash is provided', function() {
    liveIntentExternalIdSubmodule.getId({ params: {
      ...defaultConfigParams.params,
      emailHash: '58131bc547fb87af94cebdaf3102321f'
    }}).callback(() => {});

    expect(window.liQHub).to.have.length(3)

    expect(window.liQHub[0]).to.eql({
      clientDetails: { name: 'prebid', version: '$prebid.version$' },
      clientRef: {},
      collectSettings: { timeout: DEFAULT_AJAX_TIMEOUT },
      consent: {},
      integration: { distributorId: defaultConfigParams.distributorId, publisherId: '89899', type: 'custom' },
      partnerCookies: new Set(),
      resolveSettings: { identityPartner: 'prebid', timeout: DEFAULT_AJAX_TIMEOUT },
      type: 'register_client'
    })

    expect(window.liQHub[1]).to.eql({
      clientRef: {},
      sourceEvent: { emailHash: '58131bc547fb87af94cebdaf3102321f' },
      type: 'collect'
    })

    const resolveCommand = window.liQHub[2]
    // functions cannot be reasonably compared, remove them
    delete resolveCommand.onSuccess[0].callback
    delete resolveCommand.onFailure

    expect(resolveCommand).to.eql({
      clientRef: {},
      onSuccess: [{ type: 'callback' }],
      requestedAttributes: [ 'nonId' ],
      type: 'resolve'
    })
  });

  it('should have the same data after call decode when appId, disrtributorId and sourceEvent is absent', function() {
    liveIntentExternalIdSubmodule.decode({}, {
      params: {
        ...defaultConfigParams.params,
        distributorId: undefined
      }
    });
    expect(window.liQHub).to.eql([{
      clientDetails: { name: 'prebid', version: '$prebid.version$' },
      clientRef: {},
      collectSettings: { timeout: DEFAULT_AJAX_TIMEOUT },
      consent: {},
      integration: { distributorId: undefined, publisherId: '89899', type: 'custom' },
      partnerCookies: new Set(),
      resolveSettings: { identityPartner: 'prebid', timeout: DEFAULT_AJAX_TIMEOUT },
      type: 'register_client'
    }])
  });

  it('should have the same data after call decode when appId and sourceEvent is present', function() {
    const configParams = {
      params: {
        ...defaultConfigParams.params,
        liCollectConfig: {
          appId: 'a-0001'
        },
        emailHash: '123'
      }
    }
    liveIntentExternalIdSubmodule.decode({}, configParams);
    expect(window.liQHub).to.eql([{
      clientDetails: { name: 'prebid', version: '$prebid.version$' },
      clientRef: {},
      collectSettings: { timeout: DEFAULT_AJAX_TIMEOUT },
      consent: {},
      integration: { appId: 'a-0001', publisherId: '89899', type: 'application' },
      partnerCookies: new Set(),
      resolveSettings: { identityPartner: 'prebid', timeout: DEFAULT_AJAX_TIMEOUT },
      type: 'register_client'
    },
    {
      clientRef: {},
      sourceEvent: { emailHash: '123' },
      type: 'collect'
    }])
  });

  it('should have the same data after call decode when distributorId and sourceEvent is present', function() {
    const configParams = {
      params: {
        ...defaultConfigParams.params,
        distributorId: 'did-1111',
        emailHash: '123'
      }
    }
    liveIntentExternalIdSubmodule.decode({}, configParams);
    expect(window.liQHub).to.eql([{
      clientDetails: { name: 'prebid', version: '$prebid.version$' },
      clientRef: {},
      collectSettings: { timeout: DEFAULT_AJAX_TIMEOUT },
      consent: {},
      integration: { distributorId: 'did-1111', publisherId: defaultConfigParams.params.publisherId, type: 'custom' },
      partnerCookies: new Set(),
      resolveSettings: { identityPartner: 'did-1111', timeout: DEFAULT_AJAX_TIMEOUT },
      type: 'register_client'
    },
    {
      clientRef: {},
      sourceEvent: { emailHash: '123' },
      type: 'collect'
    }])
  });

  it('should include the identifier data if it is present in config', function() {
    const configParams = {
      params: {
        ...defaultConfigParams.params,
        distributorId: 'did-1111',
        emailHash: '123',
        ipv4: 'foov4',
        ipv6: 'foov6',
        userAgent: 'bar'
      }
    }
    liveIntentExternalIdSubmodule.decode({}, configParams);
    expect(window.liQHub).to.eql([{
      clientDetails: { name: 'prebid', version: '$prebid.version$' },
      clientRef: {},
      collectSettings: { timeout: DEFAULT_AJAX_TIMEOUT },
      consent: {},
      integration: { distributorId: 'did-1111', publisherId: defaultConfigParams.params.publisherId, type: 'custom' },
      partnerCookies: new Set(),
      resolveSettings: { identityPartner: 'did-1111', timeout: DEFAULT_AJAX_TIMEOUT },
      type: 'register_client'
    },
    {
      clientRef: {},
      sourceEvent: { emailHash: '123', ipv4: 'foov4', ipv6: 'foov6', userAgent: 'bar' },
      type: 'collect'
    }])
  });

  it('should have the same data when decode with privacy settings', function() {
    uspConsentDataStub.returns('1YNY');
    gdprConsentDataStub.returns({
      gdprApplies: false,
      consentString: 'consentDataString'
    })
    gppConsentDataStub.returns({
      gppString: 'gppConsentDataString',
      applicableSections: [1]
    })
    liveIntentExternalIdSubmodule.decode({}, defaultConfigParams);
    expect(window.liQHub).to.eql([{
      clientDetails: { name: 'prebid', version: '$prebid.version$' },
      clientRef: {},
      collectSettings: { timeout: DEFAULT_AJAX_TIMEOUT },
      consent: { gdpr: { consentString: 'consentDataString', gdprApplies: false }, gpp: { applicableSections: [1], consentString: 'gppConsentDataString' }, usPrivacy: { consentString: '1YNY' } },
      integration: { distributorId: defaultConfigParams.params.distributorId, publisherId: defaultConfigParams.params.publisherId, type: 'custom' },
      partnerCookies: new Set(),
      resolveSettings: { identityPartner: 'prebid', timeout: DEFAULT_AJAX_TIMEOUT },
      type: 'register_client'
    }])
  });

  it('should not fire event again when it is already fired', function() {
    liveIntentExternalIdSubmodule.decode({}, defaultConfigParams);
    liveIntentExternalIdSubmodule.decode({}, defaultConfigParams);

    expect(window.liQHub).to.have.length(1) // instead of 2
  });

  it('should decode a unifiedId to lipbId and remove it', function() {
    const result = liveIntentExternalIdSubmodule.decode({ unifiedId: 'data' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'data'}});
  });

  it('should decode a nonId to lipbId', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'data' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'data', 'nonId': 'data'}});
  });

  it('should resolve extra attributes', function() {
    liveIntentExternalIdSubmodule.getId({ params: {
      ...defaultConfigParams.params,
      ...{ requestedAttributesOverrides: { 'foo': true, 'bar': false } }
    } }).callback(() => {});

    expect(window.liQHub).to.have.length(2)
    expect(window.liQHub[0]).to.eql({
      clientDetails: { name: 'prebid', version: '$prebid.version$' },
      clientRef: {},
      collectSettings: { timeout: DEFAULT_AJAX_TIMEOUT },
      consent: {},
      integration: { distributorId: defaultConfigParams.distributorId, publisherId: '89899', type: 'custom' },
      partnerCookies: new Set(),
      resolveSettings: { identityPartner: 'prebid', timeout: DEFAULT_AJAX_TIMEOUT },
      type: 'register_client'
    })

    const resolveCommand = window.liQHub[1]

    // functions cannot be reasonably compared, remove them
    delete resolveCommand.onSuccess[0].callback
    delete resolveCommand.onFailure

    expect(resolveCommand).to.eql({
      clientRef: {},
      onSuccess: [{ type: 'callback' }],
      requestedAttributes: [ 'nonId', 'foo' ],
      type: 'resolve'
    })
  });

  it('should decode values with the segments but no nonId', function() {
    const result = liveIntentExternalIdSubmodule.decode({segments: ['tak']}, defaultConfigParams);
    expect(result).to.eql({'lipb': {'segments': ['tak']}});
  });

  it('should decode a uid2 to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', uid2: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'uid2': 'bar'}, 'uid2': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode values with uid2 but no nonId', function() {
    const result = liveIntentExternalIdSubmodule.decode({ uid2: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'uid2': 'bar'}, 'uid2': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode a bidswitch id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', bidswitch: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'bidswitch': 'bar'}, 'bidswitch': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode a medianet id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', medianet: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'medianet': 'bar'}, 'medianet': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode a sovrn id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', sovrn: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'sovrn': 'bar'}, 'sovrn': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode a magnite id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', magnite: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'magnite': 'bar'}, 'magnite': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode an index id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', index: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'index': 'bar'}, 'index': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode an openx id to a separate object when present', function () {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', openx: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'openx': 'bar'}, 'openx': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode an pubmatic id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', pubmatic: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'pubmatic': 'bar'}, 'pubmatic': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode a thetradedesk id to a separate object when present', function() {
    const provider = 'liveintent.com'
    refererInfoStub.returns({domain: provider})
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', thetradedesk: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'tdid': 'bar'}, 'tdid': {'id': 'bar', 'ext': {'rtiPartner': 'TDID', 'provider': provider}}});
  });

  it('should allow disabling nonId resolution', function() {
    liveIntentExternalIdSubmodule.getId({ params: {
      ...defaultConfigParams.params,
      ...{ requestedAttributesOverrides: { 'nonId': false, 'uid2': true } }
    } }).callback(() => {});

    expect(window.liQHub).to.have.length(2)
    expect(window.liQHub[0]).to.eql({
      clientDetails: { name: 'prebid', version: '$prebid.version$' },
      clientRef: {},
      collectSettings: { timeout: DEFAULT_AJAX_TIMEOUT },
      consent: {},
      integration: { distributorId: defaultConfigParams.distributorId, publisherId: '89899', type: 'custom' },
      partnerCookies: new Set(),
      resolveSettings: { identityPartner: 'prebid', timeout: DEFAULT_AJAX_TIMEOUT },
      type: 'register_client'
    })

    const resolveCommand = window.liQHub[1]
    // functions cannot be reasonably compared, remove them
    delete resolveCommand.onSuccess[0].callback
    delete resolveCommand.onFailure

    expect(resolveCommand).to.eql({
      clientRef: {},
      onSuccess: [{ type: 'callback' }],
      requestedAttributes: [ 'uid2' ],
      type: 'resolve'
    })
  });

  it('should decode a sharethrough id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', sharethrough: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'sharethrough': 'bar'}, 'sharethrough': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode a sonobi id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', sonobi: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'sonobi': 'bar'}, 'sonobi': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode a triplelift id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', triplelift: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'triplelift': 'bar'}, 'triplelift': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode a zetassp id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', zetassp: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'zetassp': 'bar'}, 'zetassp': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode a nexxen id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', nexxen: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'nexxen': 'bar'}, 'nexxen': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode a vidazoo id to a separate object when present', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', vidazoo: 'bar' }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'vidazoo': 'bar'}, 'vidazoo': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
  });

  it('should decode the segments as part of lipb', function() {
    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', 'segments': ['bar'] }, defaultConfigParams);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'segments': ['bar']}});
  });

  it('getId does not set the global variables when liModuleEnabled, liTreatmentRate and activatePartialTreatment are undefined', function() {
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = undefined;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: undefined } };

    liveIntentExternalIdSubmodule.getId(configWithPartialTreatment).callback(() => {});
    expect(window.liModuleEnabled).to.be.undefined
    expect(window.liTreatmentRate).to.be.undefined
  });

  it('getId does not set the global variables when liModuleEnabled is undefined, liTreatmentRate is 0.7 and activatePartialTreatment is undefined', function() {
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: undefined } };

    liveIntentExternalIdSubmodule.getId(configWithPartialTreatment).callback(() => {});
    expect(window.liModuleEnabled).to.be.undefined
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('getId does not set the global variables when liModuleEnabled is undefined, liTreatmentRate is 0.7 and activatePartialTreatment is false', function() {
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: false } };

    liveIntentExternalIdSubmodule.getId(configWithPartialTreatment).callback(() => {});
    expect(window.liModuleEnabled).to.be.undefined
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('getId does not change the global variables when liModuleEnabled is true, liTreatmentRate is 0.7 and activatePartialTreatment is true', function() {
    randomStub.returns(1.0) // 1.0 < 0.7 = false, but should be ignored by the module
    window.liModuleEnabled = true;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: true } };

    liveIntentExternalIdSubmodule.getId(configWithPartialTreatment).callback(() => {});
    expect(window.liModuleEnabled).to.eq(true)
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('getId does not change the global variables when liModuleEnabled is false, liTreatmentRate is 0.7 and activatePartialTreatment is true', function() {
    randomStub.returns(0.5) // 0.5 < 0.7 = true, but should be ignored by the module
    window.liModuleEnabled = false;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: true } };

    liveIntentExternalIdSubmodule.getId(configWithPartialTreatment).callback(() => {});
    expect(window.liModuleEnabled).to.eq(false)
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('getId sets the global variables correctly when liModuleEnabled is undefined, liTreatmentRate is 0.7 and activatePartialTreatment is true, and experiment returns false', function() {
    randomStub.returns(1) // 1 < 0.7 = false
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: true } };

    liveIntentExternalIdSubmodule.getId(configWithPartialTreatment).callback(() => {});
    expect(window.liModuleEnabled).to.eq(false)
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('getId sets the global variables correctly when liModuleEnabled is undefined, liTreatmentRate is undefined and activatePartialTreatment is true, and experiment returns true', function() {
    randomStub.returns(0.0) // 0.0 < DEFAULT_TREATMENT_RATE (0.97) = true
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = undefined;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: true } };

    liveIntentExternalIdSubmodule.getId(configWithPartialTreatment).callback(() => {});
    expect(window.liModuleEnabled).to.eq(true)
    expect(window.liTreatmentRate).to.eq(DEFAULT_TREATMENT_RATE)
  });

  it('should decode IDs when liModuleEnabled, liTreatmentRate and activatePartialTreatment are undefined', function() {
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = undefined;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: undefined } };

    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', vidazoo: 'bar', segments: ['tak'] }, configWithPartialTreatment);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'vidazoo': 'bar', 'segments': ['tak']}, 'vidazoo': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
    expect(window.liModuleEnabled).to.be.undefined
    expect(window.liTreatmentRate).to.be.undefined
  });

  it('should decode IDs when liModuleEnabled is undefined, liTreatmentRate is 0.7 and activatePartialTreatment is undefined', function() {
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: undefined } };

    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', vidazoo: 'bar', segments: ['tak'] }, configWithPartialTreatment);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'vidazoo': 'bar', 'segments': ['tak']}, 'vidazoo': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
    expect(window.liModuleEnabled).to.be.undefined
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('should decode IDs when liModuleEnabled is undefined, liTreatmentRate is 0.7 and activatePartialTreatment is false', function() {
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: false } };

    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', vidazoo: 'bar', segments: ['tak'] }, configWithPartialTreatment);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'vidazoo': 'bar', 'segments': ['tak']}, 'vidazoo': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
    expect(window.liModuleEnabled).to.be.undefined
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('should decode IDs when liModuleEnabled is true, liTreatmentRate is 0.7 and activatePartialTreatment is true', function() {
    randomStub.returns(1.0) // 1 < 0.7 = false, but should be ignored by the module as liModuleEnabled is already defined
    window.liModuleEnabled = true;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: true } };

    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', vidazoo: 'bar', segments: ['tak'] }, configWithPartialTreatment);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'vidazoo': 'bar', 'segments': ['tak']}, 'vidazoo': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
    expect(window.liModuleEnabled).to.eq(true)
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('should not decode IDs when liModuleEnabled is false, liTreatmentRate is 0.7 and activatePartialTreatment is true', function() {
    randomStub.returns(0.5) // 0.5 < 0.7 = true, but should be ignored by the module as liModuleEnabled is already defined
    window.liModuleEnabled = false;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: true } };

    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', vidazoo: 'bar', segments: ['tak'] }, configWithPartialTreatment);
    expect(result).to.eql({});
    expect(window.liModuleEnabled).to.eq(false)
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('should not decode IDs when liModuleEnabled is false, liTreatmentRate is 0.7 and activatePartialTreatment is true', function() {
    window.liModuleEnabled = false;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: true } };

    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', vidazoo: 'bar', segments: ['tak'] }, configWithPartialTreatment);
    expect(result).to.eql({});
    expect(window.liModuleEnabled).to.eq(false)
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('should not decode IDs when liModuleEnabled is undefined, liTreatmentRate is 0.7 and activatePartialTreatment is true, and experiment returns false', function() {
    randomStub.returns(1.0) // 1.0 < 0.7 = false
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = 0.7;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: true } };

    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', vidazoo: 'bar', segments: ['tak'] }, configWithPartialTreatment);
    expect(result).to.eql({});
    expect(window.liModuleEnabled).to.eq(false)
    expect(window.liTreatmentRate).to.eq(0.7)
  });

  it('should not decode IDs when liModuleEnabled is undefined, liTreatmentRate is undefined and activatePartialTreatment is true, and experiment returns false', function() {
    randomStub.returns(1.0) // 1.0 < DEFAULT_TREATMENT_RATE (0.97) = false
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = undefined;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: true } };

    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', vidazoo: 'bar', segments: ['tak'] }, configWithPartialTreatment);
    expect(result).to.eql({});
    expect(window.liModuleEnabled).to.eq(false)
    expect(window.liTreatmentRate).to.eq(DEFAULT_TREATMENT_RATE)
  });

  it('should decode IDs when liModuleEnabled is undefined, liTreatmentRate is undefined and activatePartialTreatment is true, and experiment returns true', function() {
    randomStub.returns(0.0) // 0.0 < DEFAULT_TREATMENT_RATE (0.97) = true
    window.liModuleEnabled = undefined;
    window.liTreatmentRate = undefined;
    const configWithPartialTreatment = { params: { ...defaultConfigParams.params, activatePartialTreatment: true } };

    const result = liveIntentExternalIdSubmodule.decode({ nonId: 'foo', vidazoo: 'bar', segments: ['tak'] }, configWithPartialTreatment);
    expect(result).to.eql({'lipb': {'lipbid': 'foo', 'nonId': 'foo', 'vidazoo': 'bar', 'segments': ['tak']}, 'vidazoo': {'id': 'bar', 'ext': {'provider': 'liveintent.com'}}});
    expect(window.liModuleEnabled).to.eq(true)
    expect(window.liTreatmentRate).to.eq(DEFAULT_TREATMENT_RATE)
  });
});
