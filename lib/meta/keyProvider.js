/**
 * Created by kras on 05.05.16.
 */
'use strict';

const { KeyProvider, util: { cast } } = require('@iondv/meta-model-contracts');
const { t } = require('@iondv/i18n');
const { format } = require('util');

/**
 * @param {{}} options
 * @param {MetaRepository} options.metaRepo
 * @param {{}} [options.keySeparators]
 * @param {String} [options.keySeparator]
 */
function MetaKeyProvider(options) {
  /**
   * @type {MetaRepository}
   */
  this.meta = options.metaRepo;

  function getSeparator(cn) {
    let keySeparator = options.keySeparator || '_';
    if (options.keySeparators && options.keySeparators.hasOwnProperty(cn)) {
      return options.keySeparators[cn] || keySeparator;
    }
    return keySeparator;
  }

  /**
   * @param {ClassMeta} cm
   * @param {Object} data
   * @returns {String | null}
   * @private
   */
  this._formKey = function (cm, data) {
    if (data === null) {
      return null;
    }
    let result = '';
    let keyProps = cm.getKeyProperties();
    let sep = getSeparator(cm.getCanonicalName());
    for (let i = 0; i < keyProps.length; i++) {
      if (data.hasOwnProperty(keyProps[i])) {
        result = result + (result ? sep : '') + data[keyProps[i]];
      }
    }
    return result || null;
  };

  /**
   * @param {ClassMeta} cm
   * @param {String} id
   * @returns {{}}
   * @private
   */
  this._keyToData = function (cm, id) {
    let result = {};
    if (typeof id === 'string') {
      let keyProps = cm.getKeyProperties();
      if (keyProps.length === 1) {
        let pm = cm.getPropertyMeta(keyProps[0]);
        if (!pm) {
          throw new Error(format(t('Attribute %s of class %s not found!'), keyProps[0], cm.getCaption()));
        }
        return {[keyProps[0]]: cast(id, pm.type)};
      }
      let sep = getSeparator(cm.getCanonicalName());
      let parts = id.split(sep);
      for (let i = 0; i < keyProps.length; i++) {
        let pm = cm.getPropertyMeta(keyProps[i]);
        if (!pm) {
          throw new Error(format(t('Attribute %s of class %s not found!'), keyProps[0], cm.getCaption()));
        }
        result[keyProps[i]] = cast(parts[i], pm.type);
      }
    }
    return result;
  };

  /**
   * @param {ClassMeta} cm
   * @param {Object} data
   * @returns {{} | null}
   * @private
   */
  this._keyData = function (cm, data) {
    let result = {};
    if (typeof data === 'object' && data) {
      let keyProps = cm.getKeyProperties();
      for (let i = 0; i < keyProps.length; i++) {
        if (data.hasOwnProperty(keyProps[i]) && data[keyProps[i]] !== null) {
          result[keyProps[i]] = data[keyProps[i]];
        } else {
          return null;
        }
      }
    }
    return result;
  };
}

MetaKeyProvider.prototype = new KeyProvider();

module.exports = MetaKeyProvider;
