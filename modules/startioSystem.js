/**
 * This module adds startio ID support to the User ID module
 * The {@link module:modules/userId} module is required
 * @module modules/startioSystem
 * @requires module:modules/userId
 */
import { logError } from '../src/utils.js';
import { submodule } from '../src/hook.js';
import { ajax } from '../src/ajax.js';
import { getStorageManager } from '../src/storageManager.js';
import { MODULE_TYPE_UID } from '../src/activities/modules.js';

const MODULE_NAME = 'startioId';
const DEFAULT_ENDPOINT = 'https://cs.startappnetwork.com/get-uid-obj?p=1002';

const storage = getStorageManager({moduleType: MODULE_TYPE_UID, moduleName: MODULE_NAME});

function getCachedId() {
  let cachedId;

  if (storage.cookiesAreEnabled()) {
    cachedId = storage.getCookie(MODULE_NAME);
  }

  if (!cachedId && storage.hasLocalStorage()) {
    const expirationStr = storage.getDataFromLocalStorage(`${MODULE_NAME}_exp`);
    if (expirationStr) {
      const expirationDate = new Date(expirationStr);
      if (expirationDate > new Date()) {
        cachedId = storage.getDataFromLocalStorage(MODULE_NAME);
      }
    }
  }

  return cachedId || null;
}

function storeId(id) {
  const expiresInDays = 90;
  const expirationDate = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toUTCString();

  if (storage.cookiesAreEnabled()) {
    storage.setCookie(MODULE_NAME, id, expirationDate, 'None');
  }

  if (storage.hasLocalStorage()) {
    storage.setDataInLocalStorage(`${MODULE_NAME}_exp`, expirationDate);
    storage.setDataInLocalStorage(MODULE_NAME, id);
  }
}

function fetchIdFromServer(callback) {
  const callbacks = {
    success: response => {
      let responseId;
      try {
        const responseObj = JSON.parse(response);
        if (responseObj && responseObj.uid) {
          responseId = responseObj.uid;
          storeId(responseId);
        } else {
          logError(`${MODULE_NAME}: Server response missing 'uid' field`);
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
}

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

    const cachedId = getCachedId();
    if (cachedId) {
      return { id: cachedId };
    }

    return { callback: fetchIdFromServer };
  },

  eids: {
    'startioId': {
      source: 'start.io',
      atype: 3
    },
  }
};

submodule('userId', startioIdSubmodule);
