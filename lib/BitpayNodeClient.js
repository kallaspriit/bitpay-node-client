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
  }

  getTokens () {
    return this.request('tokens').then(result => {
      console.log('got result', result)

      return result.data.reduce((tokenMap, item) => {
        Object.keys(item).forEach(tokenName => {
          tokenMap[tokenName] = item[tokenName]
        })

        return tokenMap
      }, {})
    })
  }

  request (path, payload = null) {
    const url = `${this.baseUrl}/${path}`
    const dataToSign = `${url}${payload ? JSON.stringify(payload) : ''}`
    const signature = BitpayNodeClient.sign(dataToSign, this.privateKey)
    const isValidSignature = BitpayNodeClient.verify(dataToSign, signature, this.publicKey)
    const fetchOptions = {
      method: 'GET',
      // body: payload ? JSON.stringify(payload) : null,
      headers: {
        'content-type': 'application/json',
        'x-identity': this.publicKey.toString('hex'),
        'x-signature': signature
      }
    }

    console.log('get tokens')
    console.log('> url', url)
    console.log('> payload', payload)
    console.log(`> data to sign: "${dataToSign}"`)
    console.log('> signature', signature)
    console.log('> isValidSignature', isValidSignature ? 'yes' : 'no')
    console.log('> fetch options', fetchOptions)

    return fetch(url, fetchOptions).then(result => result.json())
  }

  static sign (data, privateKey) {
    let dataBuffer

    if (Buffer.isBuffer(data)) {
      dataBuffer = data
    } else {
      console.log('making buffer from', data)
      // dataBuffer = new Buffer(data, 'hex');
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
      // dataBuffer = new Buffer(data, 'hex');
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
