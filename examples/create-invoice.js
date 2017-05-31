import fs from 'fs'
import path from 'path'
import BitpayNodeClient from '../lib/BitpayNodeClient'

const privateKeyFilename = path.join(__dirname, '..', 'api.key')
const encryptedPrivateKey = fs.readFileSync(privateKeyFilename, 'utf8')
const bitpay = new BitpayNodeClient({
  encryptedPrivateKey
})

bitpay.getTokens()
  .then(() => bitpay.asMerchant().post('invoices', {
    price: 1,
    currency: 'USD'
  }))
  .then((invoices) => {
    console.log('invoices', invoices)
  })
