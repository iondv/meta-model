/**
 * Created by krasilneg on 25.04.17.
 */
'use strict';

const { IonError } = require('@iondv/core');

const PREFIX = 'meta-repo';

const errors = module.exports = {
  NO_CLASS: `${PREFIX}.nc`,
  NO_ATTR: `${PREFIX}.na`,
  NO_VIEW: `${PREFIX}.nv`,
  NO_WORKFLOW: `${PREFIX}.nw`
};

IonError.registerMessages(errors);