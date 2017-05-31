'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _secp256k = require('secp256k1');

var _secp256k2 = _interopRequireDefault(_secp256k);

var _bs = require('bs58');

var _bs2 = _interopRequireDefault(_bs);

var _nodeFetch = require('node-fetch');

var _nodeFetch2 = _interopRequireDefault(_nodeFetch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// or secp256k1/elliptic
class BitpayNodeClient {

  constructor({
    encryptedPrivateKey,
    privateKeyPassword = '',
    baseUrl = 'https://bitpay.com'
  }) {
    this.encryptedPrivateKey = encryptedPrivateKey;
    this.privateKeyPassword = privateKeyPassword;
    this.baseUrl = baseUrl;
    this.decryptedPrivateKey = BitpayNodeClient.decryptPassword(privateKeyPassword, encryptedPrivateKey);
    this.privateKeyBuffer = Buffer.from(this.decryptedPrivateKey, 'hex');
    this.publicKey = _secp256k2.default.publicKeyCreate(this.privateKeyBuffer);
    this.tokenMap = null;
    this.facade = null;
  }

  getTokens() {
    return this.get('tokens').then(result => {
      this.tokenMap = result.data.reduce((tokenMap, item) => {
        Object.keys(item).forEach(tokenName => {
          tokenMap[tokenName] = item[tokenName];
        });

        return tokenMap;
      }, {});

      return this.tokenMap;
    });
  }

  request(method, path, payload = null) {
    if (this.facade !== null) {
      payload.token = this.tokenMap[this.facade];
    }

    const url = `${this.baseUrl}/${path}`;
    const dataToSign = `${url}${payload ? JSON.stringify(payload) : ''}`;
    const signature = BitpayNodeClient.sign(dataToSign, this.privateKeyBuffer);
    // const isSignatureValid = BitpayNodeClient.verify(dataToSign, signature, this.publicKey)
    const fetchOptions = {
      method,
      body: payload ? JSON.stringify(payload) : null,
      headers: {
        'content-type': 'application/json',
        'x-identity': this.publicKey.toString('hex'),
        'x-signature': signature
      }
    };

    this.facade = null;

    return (0, _nodeFetch2.default)(url, fetchOptions).then(result => result.json());
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, payload) {
    return this.request('POST', path, payload);
  }

  as(facade) {
    if (this.tokenMap === null) {
      throw new Error(`Unable to use facade "${facade}", the tokens have not been loaded (call getTokens() first)`);
    }

    if (this.tokenMap[facade] === undefined) {
      throw new Error(`Unable to use facade "${facade}", no such facade available (expected one of ${Object.keys(this.tokenMap).join(', ')})`);
    }

    this.facade = facade;

    return this;
  }

  asMerchant() {
    this.as(BitpayNodeClient.Facade.MERCHANT);

    return this;
  }

  asPOS() {
    this.as(BitpayNodeClient.Facade.POS);

    return this;
  }

  static sign(data, privateKey) {
    let dataBuffer;

    if (Buffer.isBuffer(data)) {
      dataBuffer = data;
    } else {
      dataBuffer = Buffer.from(data, 'utf8');
    }

    let privateKeyBuffer;

    if (Buffer.isBuffer(privateKey)) {
      privateKeyBuffer = privateKey;
    } else {
      privateKeyBuffer = Buffer.from(privateKey, 'hex');
    }

    const hashBuffer = _crypto2.default.createHash('sha256').update(dataBuffer).digest();
    const signatureInfo = _secp256k2.default.sign(hashBuffer, privateKeyBuffer);

    return signatureInfo.signature.toString('hex');
  }

  static verifySignature(data, signature, publicKey) {
    let dataBuffer;

    if (Buffer.isBuffer(data)) {
      dataBuffer = data;
    } else {
      dataBuffer = Buffer.from(data, 'utf8');
    }

    let publicKeyBuffer;

    if (Buffer.isBuffer(publicKey)) {
      publicKeyBuffer = publicKey;
    } else {
      publicKeyBuffer = Buffer.from(publicKey, 'hex');
    }

    let signatureBuffer;

    if (Buffer.isBuffer(signature)) {
      signatureBuffer = signature;
    } else {
      signatureBuffer = Buffer.from(signature, 'hex');
    }

    const hashBuffer = _crypto2.default.createHash('sha256').update(dataBuffer).digest();
    const verificationResult = _secp256k2.default.verify(hashBuffer, signatureBuffer, publicKeyBuffer);

    return verificationResult;
  }

  static decryptPassword(password, str) {
    const aes256 = _crypto2.default.createDecipher('aes-256-cbc', password);
    const a = aes256.update(Buffer.from(_bs2.default.decode(str)));
    const b = aes256.final();
    const buf = Buffer.alloc(a.length + b.length);

    a.copy(buf, 0);
    b.copy(buf, a.length);

    return buf.toString('utf8');
  }
}
exports.default = BitpayNodeClient;
BitpayNodeClient.Facade = {
  POS: 'pos',
  MERCHANT: 'merchant'
};