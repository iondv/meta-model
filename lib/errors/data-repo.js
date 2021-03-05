/**
 * Created by krasilneg on 25.04.17.
 */
'use strict';
const { IonError } = require('@iondv/core');
const { w: t } = require('@iondv/i18n');

const PREFIX = 'data-repo';

const codes = module.exports = {
  ITEM_EXISTS: `${PREFIX}.exists`,
  ITEM_EXISTS_MULTI: `${PREFIX}.iem`,
  ITEM_NOT_FOUND: `${PREFIX}.inf`,
  EXISTS_IN_COL: `${PREFIX}.eic`,
  BAD_PARAMS: `${PREFIX}.bp`,
  FILE_ATTR_SAVE: `${PREFIX}.fas`,
  FILE_ATTR_LOAD: `${PREFIX}.fal`,
  NO_COLLECTION: `${PREFIX}.nocol`,
  INVALID_META: `${PREFIX}.im`,
  COMPOSITE_KEY: `${PREFIX}.ck`,
  CONTAINER_NOT_FOUND: `${PREFIX}.cnf`,
  FAIL: `${PREFIX}.fail`,
  MISSING_REQUIRED: `${PREFIX}.mr`,
  NO_KEY_SPEC: `${PREFIX}.nkv`,
  NO_BACK_REF: `${PREFIX}.nbr`,
  UNEXPECTED_ASYNC: `${PREFIX}.ueasync`,
  PERMISSION_LACK: `${PREFIX}.noperm`
};

IonError.registerMessages({
  [codes.ITEM_EXISTS]: t(`%class with this '%attr' value already exists.`),
  [codes.ITEM_EXISTS_MULTI]: t(`%class having same values of '%attr' already exists.`),
  [codes.ITEM_NOT_FOUND]: t(`Object '%info' not found.`),
  [codes.EXISTS_IN_COL]: t(`Object '%info' is aleady in collection '%col'.`),
  [codes.BAD_PARAMS]: t(`Invalid parameters specified for method '%method'.`),
  [codes.FILE_ATTR_SAVE]: t(`Failed to save data to file attribute '%attr' of object '%info'.`),
  [codes.FILE_ATTR_LOAD]: t(`Failed to load file attribute '%attr'.`),
  [codes.NO_COLLECTION]: t(`collection '%attr' is abscent in object %info.`),
  [codes.INVALID_META]: t(`Error in meta-model of object '%info'.`),
  [codes.COMPOSITE_KEY]: t(`Using complex keys in operation '%oper' is not supported yet.`),
  [codes.FAIL]: t(`'%operation' action was not applied to object '%info'.`),
  [codes.MISSING_REQUIRED]: t(`Required attributes are not set for object %info.`),
  [codes.NO_KEY_SPEC]: t(`Key attribute value not set for object %info.`),
  [codes.NO_BACK_REF]: t(`Attribute %backAttr not found for back reference %backRef.`),
  [codes.UNEXPECTED_ASYNC]: t(`Async operation performed when calculation the default value for attribute %info.`),
  [codes.PERMISSION_LACK]: t(`Not enough permissions for action`)
});
