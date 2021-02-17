/**
 * Created by krasilneg on 17.07.17.
 */

const { DataRepository: { Item } } = require('@iondv/meta-model-contracts');

module.exports = function () {
  let processed = [];
  return function (v) {
    if (v instanceof Item) {
      v = v.getItemId();
    }
    if (processed.indexOf(v) < 0) {
      processed.push(v);
      return false;
    } else {
      return true;
    }
  };
};
