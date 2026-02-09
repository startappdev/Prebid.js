/**
 * This module adds startio ID support to the User ID module
 * The {@link module:modules/userId} module is required
 * @module modules/startioSystem
 * @requires module:modules/userId
 */
import { logError } from '../src/utils.js';
import { submodule } from '../src/hook.js';
import { ajax } from '../src/ajax.js';

const MODULE_NAME = 'startioId';
const DEFAULT_ENDPOINT = 'https://cs.startappnetwork.com/get-uid-obj?p=1002';

export const startioIdSubmodule = {
  name: MODULE_NAME,
  decode(value) {
    return value && typeof value === 'string'
      ? { 'startioId': value }
      : undefined;
  },
  getId(config, consentData, storedId) {
    if (storedId) {
      return { id: storedId };
    }

    const resp = function (callback) {
      const callbacks = {
        success: response => {
          let responseId;
          try {
            const responseObj = JSON.parse(response);
            if (responseObj && responseObj.id) {
              responseId = responseObj.id;
            } else {
              logError(`${MODULE_NAME}: Server response missing 'id' field`);
            }
          } catch (error) {
            logError(`${MODULE_NAME}: Error parsing server response`, error);
          }
          callback(responseId);
        },
        error: error => {
          logError(`${MODULE_NAME}: ID fetch encountered an error`, error);
          callback();
        }
      };
      ajax(DEFAULT_ENDPOINT, callbacks, undefined, { method: 'GET' });
    };
    return { callback: resp };
  },

  eids: {
    'startioId': {
      source: 'start.io',
      atype: 3
    },
  }
};

submodule('userId', startioIdSubmodule);
