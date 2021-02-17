/**
 * Created by krasilneg on 20.12.16.
 */
// jscs:disable requireCamelCaseOrUpperCaseIdentifiers
'use strict';

const { data: { DataRepository, Item }, PropertyTypes } = require('@iondv/meta-model-contracts');
const { Permissions, RoleAccessManager } = require('@iondv/acl-contracts');
const { Logger } = require('@iondv/commons-contracts');
const { IonError } = require('@iondv/core');
const Errors = require('../errors/data-repo');
const { t } = require('@iondv/i18n');
const { format } = require('util');
const merge = require('merge');
const clone = require('fast-clone');

/* jshint maxstatements: 100, maxcomplexity: 100, maxdepth: 30 */
function AclMock() {
  /**
   * @returns {Promise}
   */
  this.checkAccess = function () {
    return new Promise(function (resolve) {
      resolve(true);
    });
  };

  /**
   * @param {String} subject
   * @param {String | String[]} resources
   * @returns {Promise}
   */
  this.getPermissions = function (subject, resources) {
    return new Promise(function (resolve) {
      var result = {};
      resources = Array.isArray(resources) ? resources : [resources];
      for (var i = 0; i < resources.length; i++) {
        result[resources[i]] = {};
        result[resources[i]][Permissions.READ] = true;
        result[resources[i]][Permissions.WRITE] = true;
        result[resources[i]][Permissions.DELETE] = true;
        result[resources[i]][Permissions.USE] = true;
        result[resources[i]][Permissions.FULL] = true;
      }
      resolve(result);
    });
  };
}

/**
 * @param {{}} options
 * @param {DataRepository} options.data
 * @param {MetaRepository} options.meta
 * @param {String} [options.roleMap]
 * @param {{}} [options.roleMap]
 * @param {AclProvider} [options.acl]
 * @param {WorkflowProvider} [options.workflow]
 * @param {MetaRepository} [options.meta]
 * @param {{}} [options.accessManager]
 * @param {Calculator} [options.calc]
 * @constructor
 */
function SecuredDataRepository(options) {

  /**
   * @type {DataRepository}
   */
  var dataRepo = options.data;

  /**
   * @type {MetaRepository}
   */
  // var metaRepo = options.meta;

  /**
   * @type {AclProvider}
   */
  var aclProvider = options.acl || new AclMock();

  /**
   * @type {WorkflowProvider}
   */
  var workflow = options.workflow;

  var classPrefix = options.classPrefix || 'c:::';
  var itemPrefix = options.itemPrefix || 'i:::';
  // var attrPrefix = options.attrPrefix || 'a:::';
  var globalMarker = options.globalMarker || '*';

  var rolePermissionCache = {};

  const resourcePortionSize = options.resourcePortionSize || 100000;

  this.init = function () {
    if (options.roleMap && options.accessManager instanceof RoleAccessManager) {
      /**
       * @type {RoleAccessManager}
       */
      let am = options.accessManager;
      let result = Promise.resolve();
      Object.keys(options.roleMap).forEach((cn) => {
        Object.keys(options.roleMap[cn]).forEach((role) => {
          let conf = options.roleMap[cn][role];
          if (conf.resource && conf.resource.id) {
            result = result
              .then(() => am
                .defineRole(role, conf.caption)
                .then(() => am.assignRoles([role], [role]))
                .then(() => am.defineResource(conf.resource.id, conf.resource.caption))
              );
          }
        });
      });
      return result;
    }
    return Promise.resolve();
  };

  /**
   * @param {ClassMeta} cm
   */
  function classRoleConfig(cm) {
    let result = null;
    if (cm.getAncestor()) {
      let anc = classRoleConfig(cm.getAncestor());
      if (anc) {
        result = merge(true, anc);
      }
    }
    if (options.roleMap && options.roleMap.hasOwnProperty(cm.getCanonicalName())) {
      result = merge(result || {}, options.roleMap[cm.getCanonicalName()]);
    }
    return result;
  }

  /*
   * @param {String[]} check
   * @param {String[]} resources
   * @param {ClassMeta} cm

  function classResources(check, resources, cm) {
    check.push(cm.getCanonicalName());
    resources.push(classPrefix + cm.getCanonicalName());
    let descendants = cm.getDescendants();
    for (let i = 0; i < descendants.length; i++) {
      classResources(check, resources, descendants[i]);
    }
  }
   */
  /*
   * @param {String} uid
   * @param {String} cn
   * @param {{} | null} filter
   * @private

  function exclude(uid, cn, filter, classPermissions) {
    return aclProvider.getResources(uid, Permissions.READ)
      .then((explicit) => {
        if (explicit.indexOf(globalMarker) >= 0) {
          if (classPermissions) {classPermissions[Permissions.READ] = true;}
          return Promise.resolve(filter);
        }

        let cm = metaRepo.getMeta(cn);
        let check = [];
        let resources = [];
        classResources(check, resources, cm);
        let items = [];
        for (let i = 0; i < explicit.length; i++) {
          if (explicit[i].substr(0, itemPrefix.length) === itemPrefix) {
            let tmp = explicit[i].replace(itemPrefix, '').split('@');
            if (tmp.length > 1) {
              if (check.indexOf(tmp[0]) >= 0) {
                items.push(tmp[1]);
              }
            }
          }
        }

        return aclProvider.getPermissions(uid, resources).then((permissions) => {
          let exc = [];
          for (let i = 0; i < check.length; i++) {
            if (!permissions[resources[i]] || !permissions[resources[i]][Permissions.READ]) {
              exc.push(check[i]);
            }
          }

          if (exc.length) {
            let cf = {[F.NOT]: [{[F.IN]: ['$_class', exc]}]};
            if (items.length) {
              permissions[classPrefix + cm.getCanonicalName()] = permissions[classPrefix + cm.getCanonicalName()] || {};
              permissions[classPrefix + cm.getCanonicalName()][Permissions.READ] = true;
              cf = {[F.OR]: [cf, filterByItemIds(options.keyProvider, cm, items)]};
            }
            if (!filter) {
              filter = cf;
            } else {
              filter = {[F.AND]: [cf, filter]};
            }
          }

          merge(classPermissions || {}, permissions[classPrefix + cm.getCanonicalName()] || {});
          return Promise.resolve(filter);
        });
      });
  }
   */

  /**
   * @param {String} className
   * @param {Object} data
   * @param {String} [version]
   * @param {{}} [options]
   * @private
   * @returns {Item | null}
   */
  this._wrap = function (className, data, version, options) {
    return dataRepo.wrap(className, data, version, options);
  };

  /*
  function cn(obj) {
    let cn;
    if (typeof obj === 'string') {
      cn = obj;
    } else if (obj instanceof Item) {
      cn = obj.getClassName();
    }
    if (!cn) {
      throw new Error('No class info passed');
    }
    return cn;
  }
   */

  /**
   *
   * @param {String | Item} obj
   * @param {{filter: Object, user: User}} options
   * @returns {Promise}
   */
  this._getCount  = function (obj, options) {
    return dataRepo.getCount(obj, options);
  };

  /**
   * @param {Item} item
   * @return {Item}
   */
  function cenzor(item, processed) {
    if (!item) {
      return item;
    }

    if (item.permissions && !item.permissions[Permissions.READ]) {
      item.emptify();
      return item;
    }

    processed = processed || {};
    let props = item.getProperties();
    Object.values(props).forEach((p) => {
      if (p.meta.type === PropertyTypes.REFERENCE || p.meta.type === PropertyTypes.COLLECTION) {
        let v = p.evaluate();
        if (v) {
          v = Array.isArray(v) ? v : [v];
          v.forEach((item) => {
            if (item instanceof Item) {
              if (!processed[item.getClassName() + '@' + item.getItemId()]) {
                processed[item.getClassName() + '@' + item.getItemId()] = true;
                cenzor(item, processed);
              }
            }
          });
        }
      }
    });
    return item;
  }

  /**
   *
   * @param {Item} item
   * @param {{}} permissions
   * @param {{}} permMap
   */
  function itemToPermMap(item, permissions, permMap, options) {
    if (item && item.getItemId()) {
      permMap[item.getClassName() + '@' + item.getItemId()] = merge(
        permMap[item.getClassName() + '@' + item.getItemId()] || true,
        permissions[itemPrefix + item.getClassName() + '@' + item.getItemId()] || {},
        permissions[classPrefix + item.getClassName()] || {},
        permissions[globalMarker] || {}
      );

      permMap[item.getClassName() + '@' + item.getItemId()].__attr = merge(
        permMap[item.getClassName() + '@' + item.getItemId()].__attr || true,
        attrPermMap(item, permissions, options, permMap[item.getClassName() + '@' + item.getItemId()]) || {}
      );

      let props = item.getProperties();
      Object.values(props).forEach((p) => {
        if (
          (p.meta.type === PropertyTypes.REFERENCE || p.meta.type === PropertyTypes.COLLECTION) &&
          (!options.needed || options.needed[p.getName()])
        ) {
          let v = p.evaluate();
          if (v) {
            if (!Array.isArray(v)) {
              v = [v];
            }
            v.forEach((item) => {
              if (item instanceof Item) {
                if (!permMap[item.getClassName() + '@' + item.getItemId()]) {
                  itemToPermMap(item, permissions, permMap, {});
                }
              }
            });
          }
        }
      });
    }
  }

  function getPermMap(list, options) {
    if (!list.length || !options.user) {
      return Promise.resolve({});
    }
    let resources = [globalMarker];

    list.forEach((item) => {
      if (item.getItemId()) {
        if (resources.indexOf(classPrefix + item.getClassName()) < 0) {
          resources.push(classPrefix + item.getClassName());
        }
        if (resources.indexOf(itemPrefix + item.getClassName() + '@' + item.getItemId()) < 0) {
          resources.push(itemPrefix + item.getClassName() + '@' + item.getItemId());
        }
        resources.push(...attrResources(item, options));
      }
    });

    let p = Promise.resolve();
    let permMap = {};

    for (let i = 0; i < Math.ceil(resources.length/resourcePortionSize); i++) {
      const start = i*resourcePortionSize;
      const portion = resources.slice(start, start + resourcePortionSize);
      p = p.then(() => aclProvider.getPermissions(options.user, portion, true))
        .then((permissions) => {
          list.forEach((item) => {
            itemToPermMap(item, permissions, permMap, options);
          });
        });
    }
    return p.then(() => permMap);
  }

  /**
   * @param {{}} moptions
   * @returns {function()}
   */
  function listCenzor(moptions) {
    return list =>
      getPermMap(list, moptions)
        .then((permMap) => {
          let result = Promise.resolve();
          list.forEach(
            (item) => {
              result = result.then(() => setItemPermissions(moptions, permMap)(item));
            }
          );
          return result;
        })
        .then(() => {
          list.forEach((item) => {
            cenzor(item);
          });
          return list;
        });
  }

  /**
   * @param {String | Item} obj
   * @param {{user: User}} [options]
   * @param {Object} [options.filter]
   * @param {Number} [options.offset]
   * @param {Number} [options.count]
   * @param {Object} [options.sort]
   * @param {Boolean} [options.countTotal]
   * @param {Number} [options.nestingDepth]
   * @param {String[][]} [options.forceEnrichment]
   * @returns {Promise}
   */
  this._getList = function (obj, moptions) {
    let opts = moptions || {};
    let cm = options.meta.getMeta(obj);
    roleEnrichment(cm, opts);
    return dataRepo.getList(obj, opts).then(listCenzor(opts));
  };

  /**
   * @param {String} className
   * @param {{uid: String}} options
   * @param {{}} [options.expressions]
   * @param {{}} [options.filter]
   * @param {{}} [options.groupBy]
   * @returns {Promise}
   */
  this._aggregate = function (className, options) {
    return dataRepo.aggregate(className, options);
  };

  /**
   * @param {Item} item
   * @param {[]} options.needed
   * @returns {Array}
   */
  function attrResources(item, options, processed) {
    processed = processed || {};
    let props = item.getProperties();
    let result = [];
    for (let nm in props) {
      if (props.hasOwnProperty(nm) && (!options.needed || options.needed[nm])) {
        let p = props[nm];
        if (p.getType() === PropertyTypes.REFERENCE) {
          let ri = p.evaluate();
          if (result.indexOf(classPrefix + p.meta._refClass.getCanonicalName()) < 0) {
            result.push(classPrefix + p.meta._refClass.getCanonicalName());
          }
          if (ri instanceof Item) {
            if (result.indexOf(classPrefix + ri.getClassName()) < 0) {
              result.push(classPrefix + ri.getClassName());
            }
            if (result.indexOf(itemPrefix + ri.getClassName() + '@' + ri.getItemId()) < 0) {
              result.push(itemPrefix + ri.getClassName() + '@' + ri.getItemId());
            }
            if (!processed[ri.getClassName() + '@' + ri.getItemId()]) {
              processed[ri.getClassName() + '@' + ri.getItemId()] = true;
              result.push(...attrResources(ri, {}, processed));
            }
          } else if (p.getValue()) {
            if (result.indexOf(itemPrefix + p.meta._refClass.getCanonicalName() + '@' + p.getValue()) < 0) {
              result.push(itemPrefix + p.meta._refClass.getCanonicalName() + '@' + p.getValue());
            }
          }
        } else if (p.getType() === PropertyTypes.COLLECTION) {
          if (result.indexOf(classPrefix + p.meta._refClass.getCanonicalName()) < 0) {
            result.push(classPrefix + p.meta._refClass.getCanonicalName());
          }
          let coll = p.evaluate();
          if (Array.isArray(coll)) {
            coll.forEach((ri) => {
              if (result.indexOf(classPrefix + ri.getClassName()) < 0) {
                result.push(classPrefix + ri.getClassName());
              }
              if (result.indexOf(itemPrefix + ri.getClassName() + '@' + ri.getItemId()) < 0) {
                result.push(itemPrefix + ri.getClassName() + '@' + ri.getItemId());
              }
              if (!processed[ri.getClassName() + '@' + ri.getItemId()]) {
                processed[ri.getClassName() + '@' + ri.getItemId()] = true;
                result.push(...attrResources(ri, {}, processed));
              }
            });
          }
        }
      }
    }
    return result;
  }

  function attrPermMap(item, permissions, options, iperm) {
    let props = item.getProperties();
    let result = {};
    let global = permissions[globalMarker] || {};
    for (let nm in props) {
      if (props.hasOwnProperty(nm) && (!options.needed || options.needed[nm])) {
        let p = props[nm];
        result[p.getName()] = {};
        result[p.getName()][Permissions.READ] = iperm[Permissions.READ] || false;
        result[p.getName()][Permissions.WRITE] = iperm[Permissions.WRITE] || false;

        if (p.getType() === PropertyTypes.REFERENCE) {
          let ri = p.evaluate();
          let cn = ri ? ri.getClassName() : p.meta._refClass.getCanonicalName();
          let tmp = itemPrefix + cn + '@' + p.getValue();
          let rperm = merge(true, permissions[tmp] || {}, global);
          let rcperm = merge(true, permissions[classPrefix + cn] || {}, global);

          result[p.getName()][Permissions.ATTR_CONTENT_CREATE] = rcperm[Permissions.USE] || false;

          result[p.getName()][Permissions.ATTR_CONTENT_VIEW] = rcperm[Permissions.READ] || rperm[Permissions.READ] || false;

          result[p.getName()][Permissions.ATTR_CONTENT_EDIT] = rcperm[Permissions.WRITE] || rperm[Permissions.WRITE] || false;

          result[p.getName()][Permissions.ATTR_CONTENT_DELETE] = rcperm[Permissions.DELETE] || rperm[Permissions.DELETE] || false;

        } else if (p.getType() === PropertyTypes.COLLECTION) {
          let cn = p.meta._refClass.getCanonicalName();
          let rcperm = merge(true, permissions[classPrefix + cn] || {}, global);

          result[p.getName()][Permissions.ATTR_CONTENT_CREATE] = rcperm[Permissions.USE] || false;

          result[p.getName()][Permissions.ATTR_CONTENT_VIEW] = true;

          result[p.getName()][Permissions.ATTR_CONTENT_EDIT] = rcperm[Permissions.WRITE] || Boolean(classRoleConfig(p.meta._refClass));

          result[p.getName()][Permissions.ATTR_CONTENT_DELETE] = rcperm[Permissions.DELETE] || Boolean(classRoleConfig(p.meta._refClass));
        }
      }
    }
    return result;
  }

  /**
   * @param {Item} item
   * @param {{}} permissions
   * @returns {{}}
   */
  function attrPermissions(item, ipermissions, permissions, options) {
    let props = item.getProperties();
    let result = {};
    let iperm = merge(true, ipermissions || {});
    for (let nm in props) {
      if (props.hasOwnProperty(nm) && (!options.needed || options.needed[nm])) {
        let p = props[nm];
        let pperm = permissions[p.getName()] || {};
        result[p.getName()] = {};
        result[p.getName()][Permissions.READ] = iperm[Permissions.READ] || false;
        result[p.getName()][Permissions.WRITE] = iperm[Permissions.WRITE] || false;

        if (p.getType() === PropertyTypes.REFERENCE) {
          result[p.getName()][Permissions.ATTR_CONTENT_CREATE] = (iperm[Permissions.WRITE] || false) && pperm[Permissions.ATTR_CONTENT_CREATE];

          result[p.getName()][Permissions.ATTR_CONTENT_VIEW] = (iperm[Permissions.READ] || false) && pperm[Permissions.ATTR_CONTENT_VIEW];

          result[p.getName()][Permissions.ATTR_CONTENT_EDIT] = (iperm[Permissions.READ] || false) && pperm[Permissions.ATTR_CONTENT_EDIT];

          result[p.getName()][Permissions.ATTR_CONTENT_DELETE] = (iperm[Permissions.WRITE] || false) && pperm[Permissions.ATTR_CONTENT_DELETE];
        } else if (p.getType() === PropertyTypes.COLLECTION) {
          result[p.getName()][Permissions.ATTR_CONTENT_CREATE] = (iperm[Permissions.WRITE] || false) && pperm[Permissions.ATTR_CONTENT_CREATE];

          result[p.getName()][Permissions.ATTR_CONTENT_VIEW] = (iperm[Permissions.READ] || false) && pperm[Permissions.ATTR_CONTENT_VIEW];

          result[p.getName()][Permissions.ATTR_CONTENT_EDIT] = (iperm[Permissions.READ] || false) || pperm[Permissions.ATTR_CONTENT_EDIT];

          result[p.getName()][Permissions.ATTR_CONTENT_DELETE] = (iperm[Permissions.WRITE] || false) && pperm[Permissions.ATTR_CONTENT_DELETE];
        }
      }
    }
    return result;
  }


  function checkSid(sid, item, user) {
    let actor = sid;
    if (sid && sid[0] === '$') {
      let pn = sid.substr(1);
      let p = item.property(pn);
      if (!p) {
        if (options.log instanceof Logger) {
          options.log.warn(format(t('Attribute %s of class %s was not found on ABAC check'), pn, item.getClassName()));
        }
        return false;
      }
      actor = p.evaluate();
      if (!actor) {
        actor = p.getValue();
      }
    }
    if (actor) {
      actor = Array.isArray(actor) ? actor : [actor];
      for (let i = 0; i < actor.length; i++) {
        let v = actor[i];
        if (v instanceof Item) {
          v = v.getItemId();
        }
        if (user.isMe(v)) {
          return true;
        }
      }
    }
  }

  function checkSidsDisj(sids, item, user) {
    if (Array.isArray(sids)) {
      for (let i = 0; i < sids.length; i++) {
        let r = (Array.isArray(sids[i])) ? checkSidsConj(sids[i], item, user) : checkSid(sids[i], item, user);
        if (r) {
          return true;
        }
      }
      return false;
    } else {
      return checkSid(sids, item, user);
    }
  }

  function checkSidsConj(sids, item, user) {
    if (Array.isArray(sids)) {
      for (let i = 0; i < sids.length; i++) {
        let r = (Array.isArray(sids[i])) ? checkSidsDisj(sids[i], item, user) : checkSid(sids[i], item, user);
        if (!r) {
          return false;
        }
      }
      return sids.length ? true : false;
    } else {
      return checkSid(sids, item, user);
    }
  }

  /**
   * @param {{user: User}} moptions
   * @param {{}} [permMap]
   * @returns {Promise.<TResult>}
   */
  function setItemPermissions(moptions, permMap, noDrill) {
    /**
     * @param {Item} item
     */
    return function (item) {
      if (!item || !moptions.user) {
        return Promise.resolve(item);
      }
      let p;
      if (!item.permissions || !item.attrPermissions) {
        let statics = permMap && permMap[item.getClassName() + '@' + item.getItemId()];

        if (!statics) {
          p = aclProvider.getPermissions(
            moptions.user, [
              globalMarker,
              classPrefix + item.getClassName(),
              itemPrefix + item.getClassName() + '@' + item.getItemId()
            ],
            true)
            .then(
              (permissions) => {
                let pmp = merge(true,
                  permissions[itemPrefix + item.getClassName() + '@' + item.getItemId()] || {},
                  permissions[classPrefix + item.getClassName()] || {},
                  permissions[globalMarker] || {}
                );
                return pmp;
              }
            );
        } else {
          let perms = clone(statics);
          delete perms.__attr;
          p = Promise.resolve(perms);
        }
        p = p.then((permissions) => {
            item.permissions = permissions;
            if (
              item.permissions[Permissions.FULL] ||
              (
                item.permissions[Permissions.READ] &&
                item.permissions[Permissions.WRITE] &&
                item.permissions[Permissions.DELETE]
              )
            ) {
              return;
            }

            let roleConf = classRoleConfig(item.getMetaClass());
            if (roleConf) {
              let result = Promise.resolve();
              Object.keys(roleConf).forEach((role) => {
                let resid = roleConf[role].resource && roleConf[role].resource.id || (classPrefix + item.getClassName());
                let sid = [];
                if (Array.isArray(roleConf[role].sids)) {
                  sid.push(...roleConf[role].sids);
                }
                if (roleConf[role].attribute) {
                  sid.push('$' + roleConf[role].attribute);
                }

                if (sid.length) {
                  if (checkSidsDisj(sid, item, moptions.user)) {
                    result = result.then(() => true);
                    if (roleConf[role].conditions && options.calc) {
                      if (typeof roleConf[role].__conditions === 'undefined') {
                        roleConf[role].__conditions = options.calc.parseFormula(roleConf[role].conditions);
                      }
                      if (roleConf[role].__conditions) {
                        result = result.then(() => roleConf[role].__conditions.apply(item));
                      }
                    }

                    result = result
                      .then((applicable) => {
                        if (!applicable) {
                          return {};
                        }
                        if (rolePermissionCache[role] && rolePermissionCache[role][resid]) {
                          return rolePermissionCache[role];
                        }
                        return aclProvider.getPermissions(role, resid, true);
                      })
                      .then((permissions) => {
                        if (!rolePermissionCache[role]) {
                          rolePermissionCache[role] = {};
                        }
                        rolePermissionCache[role][resid] = permissions[resid] || {};
                        if (permissions[resid]) {
                          for (let p in permissions[resid]) {
                            if (permissions[resid].hasOwnProperty(p)) {
                              if (!item.permissions[p]) {
                                item.permissions[p] = permissions[resid][p];
                              }
                            }
                          }
                        }
                      });
                  }
                }
              });
              return result;
            }
          })
          .then(() => {
            if (workflow && options.meta) {
              let wfs = options.meta.getWorkflows(item.getClassName());
              if (wfs.length) {
                return workflow.getStatus(item, moptions)
                  .then((status) => {
                    item.permissions = merge(false, true, item.permissions || {}, status.itemPermissions);
                    item.attrPermissions = status.propertyPermissions || {};
                  });
              }
            }
            return Promise.resolve();
          })
          .then(() => noDrill ? null :
            ((statics && statics.__attr) ?
              attrPermissions(item, item.permissions, clone(statics.__attr), moptions) :
              aclProvider.getPermissions(moptions.user, attrResources(item, moptions)).then(ap => attrPermissions(item, item.permissions, attrPermMap(item, ap, moptions, item.permissions), moptions))))
          .then((ap) => {
            item.attrPermissions = merge(false, true, item.attrPermissions || {}, ap || {});
          });
      } else {
        p = Promise.resolve();
      }
      return p.then(
        () => {
          if (!noDrill && item.permissions[Permissions.READ]) {
            let props = item.getProperties();
            let items = [];
            Object.values(props).forEach((p) => {
              if (!moptions.needed || moptions.needed[p.getName()]) {
                if (p.meta.type === PropertyTypes.REFERENCE) {
                  let ri = p.evaluate();
                  if ((ri instanceof Item) && (!ri.permissions || !ri.attrPermissions)) {
                    items.push(ri);
                  }
                } else if (p.meta.type === PropertyTypes.COLLECTION) {
                  let collection = p.evaluate();
                  if (Array.isArray(collection)) {
                    items.push(...collection.filter(ri => (ri instanceof Item) && (!ri.permissions || !ri.attrPermissions)));
                  }
                }
              }
            });

            if (Array.isArray(items) && items.length) {
              return (
                permMap ? Promise.resolve(permMap) : getPermMap(items, {user: moptions.user})
              ).then((permMap) => {
                let w1 = Promise.resolve();
                items.forEach((ri) => {
                  w1 = w1.then(() => setItemPermissions({user: moptions.user}, permMap)(ri));
                });
                return w1;
              });
            }
          }
        })
        .then(() => item);
    };
  }

  /**
   * @param {ClassMeta} cm
   * @param {Array} path
   */
  function findPm(cm, path) {
    let c = cm;
    for (let i = 0; i < path.length; i++) {
      let pm = c.getPropertyMeta(path[i]);
      if (!pm) {
        break;
      }
      if (i === path.length - 1) {
        return pm;
      }
      if (!pm._refClass) {
        break;
      }
      c = pm._refClass;
    }
    return null;
  }

  /**
   * @param {ClassMeta} cm
   * @param {Array} a
   */
  function reduceRefAttr(cm, a) {
    let tmp = a.slice(0, a.length - 1);
    let pm = findPm(cm, tmp);
    if (!pm) {
      if (options.log instanceof Logger) {
        options.log.warn(format(t('Attribute %s of class %s was not found on ABAC check'), tmp.join('.'), cm.getCanonicalName()));
      }
      return [];
    }
    if (pm.type !== PropertyTypes.REFERENCE && pm.type !== PropertyTypes.COLLECTION) {
      return [];
    }

    if (pm.type === PropertyTypes.REFERENCE) {
      let attr = a[a.length - 1];
      let keys = pm._refClass.getKeyProperties();
      if (keys.length === 1 && keys[0] === attr) {
        return reduceRefAttr(cm, tmp);
      }
    }

    return tmp;
  }

  function addEagerAttr(nm, cm, opts) {
    let a = nm.split('.');
    if (a.length > 1) {
      a = reduceRefAttr(cm, a);
      if (a.length) {
        opts.forceEnrichment.push(a);
      }
    }
  }

  function processSid(sid, cm, opts) {
    if (Array.isArray(sid)) {
      sid.forEach((v) => {
        processSid(v, opts);
      });
    } else if (typeof sid === 'string' && sid) {
      if (sid[0] === '$') {
        addEagerAttr(sid.substr(1), cm, opts);
      }
    }
  }

  /**
   * @param {ClassMeta} cm
   * @param {{}} opts
   * @returns {*}
   */
  function roleEnrichment(cm, opts) {
    let fe = [];
    if ((typeof opts.nestingDepth === 'number') && (opts.nestingDepth > 0)) {
      Object.values(cm.getPropertyMetas()).forEach((pm) => {
        if (pm && (pm.type === PropertyTypes.REFERENCE || pm.type === PropertyTypes.COLLECTION)) {
          fe.push([pm.name]);
        }
      });
    } else {
      fe = Array.isArray(opts.forceEnrichment) ? opts.forceEnrichment.slice(0) : [];
    }
    opts.forceEnrichment = opts.forceEnrichment || [];
    fe.forEach((elp) => {
      if (Array.isArray(elp)) {
        for (let i = 0; i < elp.length; i++) {
          let tmp = elp.slice(0, i + 1);
          let pm = findPm(cm, tmp);
          if (pm && (pm.type === PropertyTypes.REFERENCE || pm.type === PropertyTypes.COLLECTION)) {
            let sub = {nestingDepth: (opts.nestingDepth || 1) - 1};
            roleEnrichment(pm._refClass, sub);
            if (Array.isArray(sub.forceEnrichment)) {
              for (let j = 0; j < sub.forceEnrichment.length; j++) {
                opts.forceEnrichment.push(tmp.concat(sub.forceEnrichment[j]));
              }
            }
          }
        }
      }
    });

    let roleConf = classRoleConfig(cm);
    if (roleConf) {
      for (let role in roleConf) {
        if (roleConf.hasOwnProperty(role)) {
          if (roleConf[role].attribute) {
            addEagerAttr(roleConf[role].attribute, cm, opts);
          }

          if (Array.isArray(roleConf[role].sids)) {
            roleConf[role].sids.forEach((sid) => {
              processSid(sid, cm, opts);
            });
          }
        }
      }
    }
    return opts;
  }

  function checkReadPermission(item) {
    if (item && item.permissions && !item.permissions[Permissions.READ]) {
      throw new IonError(Errors.PERMISSION_LACK);
    }
    return item;
  }

  function getItem(obj, id, moptions) {
    let opts = moptions || {};
    let cm = obj instanceof Item ? obj.getMetaClass() : options.meta.getMeta(obj);
    roleEnrichment(cm, opts);
    return dataRepo.getItem(obj, id || '', opts)
      .then(item => item ?
        getPermMap([item], moptions)
          .then(permMap => setItemPermissions(opts, permMap)(item)) :
        item
      );
  }

  /**
   * @param {String | Item} obj
   * @param {String} [id]
   * @param {{uid: String}} moptions
   * @param {Number} [options.nestingDepth]
   */
  this._getItem = function (obj, id, moptions) {
    return getItem(obj, id, moptions).then(checkReadPermission).then(cenzor);
  };

  /**
   * @param {String} classname
   * @param {Object} data
   * @param {String} [version]
   * @param {ChangeLogger | Function} [changeLogger]
   * @param {{user: User}} moptions
   * @returns {Promise}
   */
  this._createItem = function (classname, data, version, changeLogger, moptions) {
    moptions = moptions || {};
    return (moptions.user ?
      aclProvider.checkAccess(moptions.user, classPrefix + classname, [Permissions.USE]) :
      Promise.resolve(true))
      .then((accessible) => {
        if (accessible) {
          let opts = moptions || {};
          let cm = options.meta.getMeta(classname);
          roleEnrichment(cm, opts);
          return dataRepo.createItem(classname, data, version, changeLogger, opts)
            .then(setItemPermissions(opts))
            .then(checkReadPermission);
        }
        throw new IonError(Errors.PERMISSION_LACK);
      });
  };

  function checkWritePermission(classname, id, moptions, data = {}) {
    if (!moptions.user) {
      return Promise.resolve(true);
    }
    return aclProvider.getPermissions(moptions.user, [classPrefix + classname, itemPrefix + classname + '@' + id])
      .then((permissions) => {
        let accessible = permissions[classPrefix + classname] &&
          permissions[classPrefix + classname][Permissions.WRITE] ||
          permissions[itemPrefix + classname + '@' + id] &&
          permissions[itemPrefix + classname + '@' + id][Permissions.WRITE];
        let cm = options.meta.getMeta(classname);
        let roleConf = classRoleConfig(cm);
        if (accessible || !workflow && !roleConf) {
          return accessible;
        }
        return getItem(classname, id, moptions)
          .then((item) => {
            if (!item) {
              return false;
            }

            if (item.attrPermissions) {
              for (let nm in data) {
                if (data.hasOwnProperty(nm) && item.attrPermissions.hasOwnProperty(nm)) {
                  if (!item.attrPermissions[nm][Permissions.WRITE]) {
                    return false;
                  }
                }
              }
            }

            return !item.permissions || item.permissions[Permissions.WRITE];
          });
      });
  }

  /**
   *
   * @param {String} classname
   * @param {String} id
   * @param {{}} data
   * @param {ChangeLogger} [changeLogger]
   * @param {{uid: String}} options
   * @returns {Promise}
   */
  this._editItem = function (classname, id, data, changeLogger, moptions) {
    let opts = moptions || {};
    return checkWritePermission(classname, id, opts, data)
      .then((writable) => {
        if (writable) {
          let cm = options.meta.getMeta(classname);
          roleEnrichment(cm, opts);
          return dataRepo.editItem(classname, id, data, changeLogger, opts)
            .then(setItemPermissions(opts))
            .then(checkReadPermission);
        }
        throw new IonError(Errors.PERMISSION_LACK);
      });
  };

  /**
   *
   * @param {String} classname
   * @param {String} id
   * @param {{}} data
   * @param {String} [version]
   * @param {ChangeLogger} [changeLogger]
   * @param {{uid: String}} [options]
   * @param {Number} [options.nestingDepth]
   * @param {Boolean} [options.autoAssign]
   * @returns {Promise}
   */
  this._saveItem = function (classname, id, data, version, changeLogger, moptions) {
    let opts = moptions || {};
    return checkWritePermission(classname, id, opts, data)
      .then(function (writable) {
        if (writable) {
          let cm = options.meta.getMeta(classname);
          roleEnrichment(cm, opts);
          return dataRepo.saveItem(classname, id, data, version, changeLogger, opts)
            .then(setItemPermissions(opts))
            .then(checkReadPermission);
        }
        throw new IonError(Errors.PERMISSION_LACK);
      });
  };

  function checkDeletePermission(classname, id, moptions) {
    if (!moptions.user) {
      return Promise.resolve(true);
    }
    return aclProvider.getPermissions(moptions.user, [classPrefix + classname, itemPrefix + classname + '@' + id])
      .then((permissions) => {
        let accessible = permissions[classPrefix + classname] &&
          permissions[classPrefix + classname][Permissions.DELETE] ||
          permissions[itemPrefix + classname + '@' + id] &&
          permissions[itemPrefix + classname + '@' + id][Permissions.DELETE];
        let cm = options.meta.getMeta(classname);
        let roleConf = classRoleConfig(cm);
        if (accessible || !workflow && !roleConf) {
          return accessible;
        }
        return getItem(classname, id, moptions)
          .then((item) => {
            if (!item) {
              return false;
            }
            return !item.permissions || item.permissions[Permissions.DELETE];
          });
      });
  }

  /**
   *
   * @param {String} classname
   * @param {String} id
   * @param {ChangeLogger} [changeLogger]
   * @param {{uid: String}} options
   */
  this._deleteItem = function (classname, id, changeLogger, options) {
    return checkDeletePermission(classname, id, options || {})
      .then((deletable) => {
        if (deletable) {
          return dataRepo.deleteItem(classname, id, changeLogger);
        }
        throw new IonError(Errors.PERMISSION_LACK);
      });
  };


  function checkCollectionWriteAccess(master, details, options) {
    return setItemPermissions(options, null, true)(master)
      .then((m) => {
        if (m.permissions && !m.permissions[Permissions.WRITE]) {
          return false;
        }
        let p = Promise.resolve();
        let breaker = '_____UNUSABLE____';
        details.forEach((d) => {
          p = p.then(() => setItemPermissions(options, null, true)(d));
          p = p.then((di) => {
            if (di.permissions && !di.permissions[Permissions.USE]) {
              return Promise.reject(breaker);
            }
            return Promise.resolve();
          });
        });
        return p.catch(e => breaker ? false : Promise.reject(e)).then(() => true);
      });
  }

  /**
   *
   * @param {Item} master
   * @param {String} collection
   * @param {Item[]} details
   * @param {ChangeLogger} [changeLogger]
   * @param {{uid: String}} options
   * @returns {Promise}
   */
  this._put = function (master, collection, details, changeLogger, options) {
    if (!details.length) {
      return Promise.resolve();
    }
    return checkCollectionWriteAccess(master, details, options || {})
      .then((writable) => {
        if (writable) {
          return dataRepo.put(master, collection, details, changeLogger);
        }
        throw new IonError(Errors.PERMISSION_LACK);
      });
  };

  /**
   *
   * @param {Item} master
   * @param {String} collection
   * @param {Item[]} details
   * @param {ChangeLogger} [changeLogger]
   * @param {{uid: String}} options
   * @returns {Promise}
   */
  this._eject = function (master, collection, details, changeLogger, options) {
    if (!details.length) {
      return Promise.resolve();
    }
    return checkCollectionWriteAccess(master, details, options || {})
      .then((writable) => {
        if (writable) {
          return dataRepo.eject(master, collection, details, changeLogger);
        }
        throw new IonError(Errors.PERMISSION_LACK);
      });
  };

  /**
   * @param {Item} master
   * @param {String} collection
   * @param {{user: User}} options
   * @param {Object} [options.filter]
   * @param {Number} [options.offset]
   * @param {Number} [options.count]
   * @param {Object} [options.sort]
   * @param {Boolean} [options.countTotal]
   * @param {Number} [options.nestingDepth]
   * @returns {Promise}
   */
  this._getAssociationsList = function (master, collection, options) {
    return setItemPermissions(options || {}, null, true)(master)
      .then((m) => {
        if (!m.permissions || m.permissions[Permissions.READ]) {
          let opts = options || {};
          let p = m.property(collection);
          if (!p) {
            throw new Error('Ivalid collection name specified!');
          }
          let cm = p.meta._refClass;
          roleEnrichment(cm, opts);
          return dataRepo.getAssociationsList(master, collection, opts).then(listCenzor(opts));
        }
        throw new IonError(Errors.PERMISSION_LACK);
      });
  };

  /**
   *
   * @param {Item} master
   * @param {String} collection
   * @param {{user: User}} options
   * @param {{}} [options.filter]
   * @returns {Promise}
   */
  this._getAssociationsCount = function (master, collection, options) {
    return setItemPermissions(options || {}, null, true)(master)
      .then(function (m) {
        if (!m.permissions || m.permissions[Permissions.READ]) {
          return dataRepo.getAssociationsCount(master, collection, options || {});
        }
        throw new IonError(Errors.PERMISSION_LACK);
      });
  };

  /**
   * @param {String} classname
   * @param {{}} data
   * @param {{}} [options]
   * @param {Object} [options.filter]
   * @param {Number} [options.nestingDepth]
   * @param {String[][]} [options.forceEnrichment]
   * @param {Boolean} [options.skipResult]
   * @param {User} [options.user]
   * @returns {Promise}
   */
  this._bulkEdit = function (classname, data, options) {
    options = options || {};
    return (options.user ? aclProvider.getPermissions(options.user, [classPrefix + classname]) : Promise.resolve(null))
      .then((permissions) => {
        if (
          !permissions ||
          permissions[classPrefix + classname] &&
          permissions[classPrefix + classname][Permissions.WRITE]
        ) {
          return dataRepo.bulkEdit(classname, data, options);
        }
        throw new IonError(Errors.PERMISSION_LACK);
      });
  };

  /**
   * @param {String} classname
   * @param {{}} [options]
   * @param {Object} [options.filter]
   * @param {User} [options.user]
   * @returns {Promise}
   */
  this._bulkDelete = function (classname, options) {
    options = options || {};
    return (options.user ? aclProvider.getPermissions(options.user, [classPrefix + classname]) : Promise.resolve(null))
      .then((permissions) => {
        if (
          !permissions ||
          permissions[classPrefix + classname] &&
          permissions[classPrefix + classname][Permissions.DELETE]
        ) {
          return dataRepo.bulkDelete(classname, options);
        }
        throw new IonError(Errors.PERMISSION_LACK);
      });
  };
}

SecuredDataRepository.prototype = new DataRepository();
module.exports = SecuredDataRepository;
