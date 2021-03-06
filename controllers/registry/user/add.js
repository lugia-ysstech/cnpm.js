'use strict';

var ensurePasswordSalt = require('./common').ensurePasswordSalt;
var userService = require('../../../services/user');
var config = require('../../../config');

// npm 1.4.4
// add new user first
// @see https://github.com/npm/npm-registry-client/commit/effb4bc88d443f764f2c2e8b4dd583cc72cf6084
// PUT /-/user/org.couchdb.user:mk2 { accept: 'application/json',
//   'accept-encoding': 'gzip',
//   'user-agent': 'node/v0.11.12 darwin x64',
//   host: '127.0.0.1:7001',
//   'content-type': 'application/json',
//   'content-length': '150',
//   connection: 'close' } { name: 'mk2',
//   password: '123456',
//   email: 'fengmk2@gmail.com',
//   _id: 'org.couchdb.user:mk2',
//   type: 'user',
//   roles: [],
//   date: '2014-03-15T02:33:19.465Z' }

// old npm flow
// json:
// PUT /-/user/org.couchdb.user:mk2 { accept: 'application/json',
//   'user-agent': 'node/v0.8.26 darwin x64',
//   host: '127.0.0.1:7001',
//   'content-type': 'application/json',
//   'content-length': '258',
//   connection: 'keep-alive' }
// { name: 'mk2',
//   salt: '12351936478446a5466d4fb1633b80f3838b4caaa03649a885ac722cd6',
//   password_sha: '123408912a6db1d96b132a90856d99db029cef3d',
//   email: 'fengmk2@gmail.com',
//   _id: 'org.couchdb.user:mk2',
//   type: 'user',
//   roles: [],
//   date: '2014-03-15T02:39:25.696Z' }
const admins = config.admins;

function* initUsers (name, ip) {
  if (!admins[ name ]) {
    return;
  }
  const { initUsers = [] } = config;

  function getInfo (user) {
    const { name, email } = user;
    return `用户名:${name}, 邮箱: ${email}`;
  }

  const resultMessages = [];
  for (let i = 0; i < initUsers.length; i++) {
    const user = initUsers[ i ];
    const { email, name, password } = user;
    const existUser = yield userService.get(name);
    if (existUser) {
      const { newPassword } = user;
      if (newPassword) {
        existUser.email = email;
        existUser.ip = ip;
        ensurePasswordSalt(existUser, { password: newPassword });
        yield userService.update(existUser);
        resultMessages.push(`${getInfo(user)} 已更新!`);
      }
      continue;
    }
    const userBO = {
      ...user, ip,
    };
    ensurePasswordSalt(userBO, user);

    if (!userBO.salt || !userBO.password_sha || !userBO.email) {
      resultMessages.push(`${getInfo(user)}，用户信息错误！`)
      continue;
    }
    const result = yield userService.add(userBO);
    resultMessages.push(`${getInfo(user)} 新增结果: ${result}！`);
  }

  return resultMessages;
}

module.exports = function* addUser () {
  var name = this.params.name;
  var body = this.request.body || {};

  if (!body.password || !body.name) {
    this.status = 422;
    this.body = {
      error: 'paramError',
      reason: 'params missing, name, email or password missing.'
    };
    return;
  }
  const ip = this.ip || '0.0.0.0';

  var loginedUser;
  try {
    loginedUser = yield userService.authAndSave(body.name, body.password);
    if (loginedUser) {
      const resultMessages = yield initUsers(name, ip);
      if (resultMessages) {
        const etag = `${resultMessages.join('\n')}`;
        this.status = 201;
        this.body = {
          ok: true,
          id: 'org.couchdb.user:' + name,
          reason: etag
        };
        return;
      }
    } else {
      if (admins[body.name]) {

        var user = {
          name: body.name,
          // salt: body.salt,
          // password_sha: body.password_sha,
          email: body.email,
          ip
          // roles: body.roles || [],
        };

        ensurePasswordSalt(user, body);

        if (!user.salt || !user.password_sha || !user.email) {
          this.status = 422;
          this.body = {
            error: 'paramError',
            reason: 'params missing, name, email or password missing.'
          };
          return;
        }

        // add new user
        var result = yield userService.add(user);
        yield initUsers(name, ip);

        this.etag = '"' + result.rev + '"';
        this.status = 201;
        this.body = {
          ok: true,
          id: 'org.couchdb.user:' + name,
          rev: result.rev
        };
      }
    }
  } catch (err) {
    this.status = err.status || 422;
    this.body = {
      error: err.name,
      reason: err.message
    };
    return;
  }

  if (loginedUser) {
    this.status = 201;
    this.body = {
      ok: true,
      id: 'org.couchdb.user:' + loginedUser.login,
      rev: Date.now() + '-' + loginedUser.login
    };
    return;
  }


  const existUser = yield userService.get(name);

  if (existUser) {
    this.status = 422;
    this.body = {
      error: '密码错误',
      reason: '密码错误'
    };
    return;
  }

  if (config.customUserService) {
    // user login fail, not allow to add new user
    this.status = 401;
    this.body = {
      error: 'unauthorized',
      reason: 'Login fail, please check your login name and password'
    };
    return;
  }

  this.status = 422;
  this.body = {
    error: '新增用户错误,本系统不支持手工注册用户',
    reason: '本系统不支持手工注册用户'
  };
};
