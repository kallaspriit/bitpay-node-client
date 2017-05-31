import fs from 'fs'
import BitpayNodeClient from './lib/BitpayNodeClient'

const bitpay = new BitpayNodeClient({
  encryptedPrivateKey: fs.readFileSync('api.key', 'utf8')
})

bitpay.getTokens()
  .then(() => bitpay.asMerchant().post('invoices', {
    price: 1,
    currency: 'USD'
  }))
  .then((invoices) => {
    console.log('invoices', invoices)
  })
