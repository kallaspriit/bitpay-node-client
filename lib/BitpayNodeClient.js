import crypto from 'crypto'
import secp256k1 from 'secp256k1' // or secp256k1/elliptic
import base58 from 'bs58'
import fetch from 'node-fetch'

export default class BitpayNodeClient {
  constructor ({
    encryptedPrivateKey,
    privateKeyPassword = '',
    baseUrl = 'https://bitpay.com'
  }) {
    this.encryptedPrivateKey = encryptedPrivateKey
    this.privateKeyPassword = privateKeyPassword
    this.baseUrl = baseUrl
    this.decryptedPrivateKey = BitpayNodeClient.decrypt(
      privateKeyPassword,
      encryptedPrivateKey
    )
    this.privateKey = Buffer.from(this.decryptedPrivateKey, 'hex') // TODO: rename privateKeyBuffer
    this.publicKey = secp256k1.publicKeyCreate(this.privateKey)
    this.tokenMap = null
    this.facade = null
  }

  getTokens () {
    return this.get('tokens').then(result => {
      this.tokenMap = result.data.reduce((tokenMap, item) => {
        Object.keys(item).forEach(tokenName => {
          tokenMap[tokenName] = item[tokenName]
        })

        return tokenMap
      }, {})

      return this.tokenMap
    })
  }

  request (method, path, payload = null) {
    if (this.facade !== null) {
      payload.token = this.tokenMap[this.facade]
    }

    const url = `${this.baseUrl}/${path}`
    const dataToSign = `${url}${payload ? JSON.stringify(payload) : ''}`
    const signature = BitpayNodeClient.sign(dataToSign, this.privateKey)
    // const isValidSignature = BitpayNodeClient.verify(dataToSign, signature, this.publicKey)
    const fetchOptions = {
      method,
      body: payload ? JSON.stringify(payload) : null,
      headers: {
        'content-type': 'application/json',
        'x-identity': this.publicKey.toString('hex'),
        'x-signature': signature
      }
    }

    this.facade = null

    return fetch(url, fetchOptions).then(result => result.json())
  }

  get (path) {
    return this.request('GET', path)
  }

  post (path, payload) {
    return this.request('POST', path, payload)
  }

  as (facade) {
    if (this.tokenMap === null) {
      throw new Error(`Unable to use facade "${facade}", the tokens have not been loaded (call getTokens() first)`)
    }

    if (this.tokenMap[facade] === undefined) {
      throw new Error(`Unable to use facade "${facade}", no such facade available (expected one of ${Object.keys(this.tokenMap).join(', ')})`)
    }

    this.facade = facade

    return this
  }

  asMerchant () {
    this.as('merchant')

    return this
  }

  static sign (data, privateKey) {
    let dataBuffer

    if (Buffer.isBuffer(data)) {
      dataBuffer = data
    } else {
      dataBuffer = Buffer.from(data, 'utf8')
    }

    let privateKeyBuffer

    if (Buffer.isBuffer(privateKey)) {
      privateKeyBuffer = privateKey
    } else {
      privateKeyBuffer = Buffer.from(privateKey, 'hex')
    }

    const hashBuffer = crypto.createHash('sha256').update(dataBuffer).digest()
    const signatureInfo = secp256k1.sign(hashBuffer, privateKeyBuffer)

    return signatureInfo.signature.toString('hex')
  }

  static verify (data, signature, publicKey) {
    let dataBuffer

    if (Buffer.isBuffer(data)) {
      dataBuffer = data
    } else {
      dataBuffer = Buffer.from(data, 'utf8')
    }

    let publicKeyBuffer

    if (Buffer.isBuffer(publicKey)) {
      publicKeyBuffer = publicKey
    } else {
      publicKeyBuffer = Buffer.from(publicKey, 'hex')
    }

    let signatureBuffer

    if (Buffer.isBuffer(signature)) {
      signatureBuffer = signature
    } else {
      signatureBuffer = Buffer.from(signature, 'hex')
    }

    const hashBuffer = crypto.createHash('sha256').update(dataBuffer).digest()
    const verificationResult = secp256k1.verify(
      hashBuffer,
      signatureBuffer,
      publicKeyBuffer
    )

    return verificationResult
  }

  static decrypt (password, str) {
    const aes256 = crypto.createDecipher('aes-256-cbc', password)
    const a = aes256.update(Buffer.from(base58.decode(str)))
    const b = aes256.final()
    const buf = Buffer.alloc(a.length + b.length)

    a.copy(buf, 0)
    b.copy(buf, a.length)

    return buf.toString('utf8')
  }
}
