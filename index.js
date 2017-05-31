import fs from 'fs'
import BitpayNodeClient from './lib/BitpayNodeClient'

const bitpay = new BitpayNodeClient({
  encryptedPrivateKey: fs.readFileSync('api.key', 'utf8')
})

bitpay.getTokens()
  .then((tokens) => {
    console.log('tokens', tokens)
  })
