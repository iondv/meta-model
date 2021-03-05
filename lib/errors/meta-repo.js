/**
 * Created by krasilneg on 25.04.17.
 */
'use strict';

const { IonError } = require('@iondv/core');
const { w: t } = require('@iondv/i18n');

const PREFIX = 'meta-repo';

const codes = module.exports = {
  NO_CLASS: `${PREFIX}.nc`,
  NO_ATTR: `${PREFIX}.na`,
  NO_VIEW: `${PREFIX}.nv`,
  NO_WORKFLOW: `${PREFIX}.nw`
};

IonError.registerMessages({
  [codes.NO_CLASS]: t('Class %class not found in namespace %namespace.'),
  [codes.NO_ATTR]: t('Attribute \'%attr\' not found in class \'%class\'.'),
  [codes.NO_VIEW]: t('View \'%view\' not found.'),
  [codes.NO_WORKFLOW]: t('Workflow \'%workflow\' not found.')
});