# Bitpay node client
Simple nodejs client for the bitpay payment system.

## Installation
`npm install --save bitpay-node-client`

## Example usage
```javascript
const fs = require('fs')
const path = require('path')
const BitpayNodeClient = require('bitpay-node-client')

const privateKeyFilename = path.join(__dirname, 'api.key')
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

```

## Running provided example
- Clone this repository
- Run `npm install`
- Generate `api.key` for merchant ([see this](https://github.com/bitpay/node-bitpay-client) for how)
- Copy the `USER_HOME/.bitpay/api.key` to this project's root directory
- Run `npm run example` to create a invoice