const express = require("express")
const fetch = require("node-fetch")
const fs = require("fs")
const path = require("path")
const app = express()

app.use(express.static(path.join(__dirname, "public")))
app.set("views", path.join(__dirname, "/pages"))
app.set("view engine", "ejs")

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"))

const rpcRequest = async (body, crypto) => {
  const {
    rpcUser,
    rpcPassword,
    rpcHost,
    rpcPort
  } = config[crypto]

  const response = await fetch(`http://${rpcUser}:${rpcPassword}@${rpcHost}:${rpcPort}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain"
    },
    body: JSON.stringify(body)
  })
  const json = JSON.parse(await response.text())
  console.log(json)
  return json.result ?? {}
}

const ethereumGetDashboardDetails = async () => {
  const {
    etherscanApiKey,
    addresses
  } = config.ethereum

  const addressList = addresses.map(a => a.address)

  const balanceResponse = await fetch(`https://api.etherscan.io/api?module=account&action=balancemulti&address=${addressList.join(",")}&tag=latest&apikey=${etherscanApiKey}`)
  const { result: balanceResult } = JSON.parse(await balanceResponse.text())
  const balances = {}
  addresses.forEach(({ address }) => {
    balances[address] = parseFloat(balanceResult.find(e => e.account === address).balance)/1000000000000000000
  })
  
  console.log(balances)
  
  const promises = []

  addresses.forEach(({ address }) => {
    promises.push(fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${etherscanApiKey}`))
    promises.push(fetch(`https://api.etherscan.io/api?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${etherscanApiKey}`))
  })

  const responses = await Promise.all(promises)
  const results = await Promise.all(responses.map(r => r.text()))

  const transactionsReceived = []

  results.forEach(r => {
    const { result = [] } = JSON.parse(r)
    result.forEach(transaction => {
      if (addressList.indexOf(transaction.to) > -1) {
        transactionsReceived.push(transaction)
      }
    })
  })

  return {
    addresses,
    balances,
    transactionsReceived
  }
}

const getCryptoShortened = (crypto) => {
  const cryptos = {
    "bitcoin": "BTC",
    "litecoin": "LTC",
    "bitcoin-cash": "BCH",
    "ethereum": "ETH"
  }
  return cryptos[crypto]
}

app.get("/", async (req, res) => {
  const {
    confirmed: btcConfirmed = 0,
    unconfirmed: btcUnconfirmed = 0
  } = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getbalance", "params": [] }, "bitcoin")
  const btc = Number((parseFloat(btcConfirmed)+parseFloat(btcUnconfirmed)).toFixed(10));

  const {
    confirmed: ltcConfirmed = 0,
    unconfirmed: ltcUnconfirmed = 0
  } = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getbalance", "params": [] }, "litecoin")
  const ltc = Number((parseFloat(ltcConfirmed)+parseFloat(ltcUnconfirmed)).toFixed(10));

  const {
    confirmed: bchConfirmed = 0,
    unconfirmed: bchUnconfirmed = 0
  } = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getbalance", "params": [] }, "bitcoin-cash")
  const bch = Number((parseFloat(bchConfirmed)+parseFloat(bchUnconfirmed)).toFixed(10));

  const { balances } = await ethereumGetDashboardDetails()
  const eth = Number((Object.entries(balances).reduce((acc, val) => acc+val[1], 0)).toFixed(10))

  const solResponse = await fetch(config.solana.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ "jsonrpc": "2.0", "id": 1, "method": "getBalance", "params": [config.solana.address] })
  })
  const solJson = JSON.parse(await solResponse.text())
  const sol = solJson.result.value/1000000000

  const xrpResponse = await fetch(config.ripple.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "id": 2,
      "command": "account_info",
      "account": config.ripple.address,
      "strict": true,
      "ledger_index": "current",
      "queue": true
    })
  })
  const xrpJson = JSON.parse(await xrpResponse.text())
  const xrp = xrpJson.result.account_data.Balance/1000000

  const nanoResponse = await fetch(`https://api.nanocrawler.cc/v2/accounts/${config.nano.address}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  })
  const nanoJson = JSON.parse(await nanoResponse.text())
  const nano = nanoJson.account.balance/1e30

  const xmrResponse = await fetch("https://api.sellix.io/v1/admin/monero/balance", {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  })
  const xmrJson = JSON.parse(await xmrResponse.text())
  const xmr = xmrJson.data.balance/1e12

  const btcUsd = Number((JSON.parse(await (await fetch("https://blockchain.info/ticker")).text()).USD.last * btc).toFixed(2))
  const ltcUsd = Number((JSON.parse(await (await fetch("https://cex.io/api/ticker/LTC/USD")).text()).last * ltc).toFixed(2))
  const bchUsd = Number((JSON.parse(await (await fetch("https://cex.io/api/ticker/BCH/USD")).text()).last * bch).toFixed(2))
  const ethUsd = Number((JSON.parse(await (await fetch("https://cex.io/api/ticker/ETH/USD")).text()).last * eth).toFixed(2))
  const solUsd = Number((JSON.parse(await (await fetch("https://cex.io/api/ticker/SOL/USD")).text()).last * sol).toFixed(2))
  const xrpUsd = Number((JSON.parse(await (await fetch("https://cex.io/api/ticker/XRP/USD")).text()).last * xrp).toFixed(2))
  const xmrUsd = Number((JSON.parse(await (await fetch("https://cex.io/api/ticker/XMR/USD")).text()).last * xmr).toFixed(2))
  const nanoUsd = Number((JSON.parse(await (await fetch("https://cex.io/api/ticker/NANO/USD")).text()).last * nano).toFixed(2))
  const totalUsd = (btcUsd+ltcUsd+bchUsd+ethUsd+solUsd+xmrUsd+xrpUsd+nanoUsd).toFixed(2)

  res.render("landing", {
    domain: req.headers.host,
    btc,
    btcUsd,
    ltc,
    ltcUsd,
    bch,
    bchUsd,
    eth,
    ethUsd,
    totalUsd
  });
})

void [
  "bitcoin",
  "litecoin",
  "bitcoin-cash"
].forEach(crypto => {
  app.get(`/${crypto}`, async (req, res) => {
    const {
      path = "",
      server = "0.0.0.0",
      blockchain_height = 0,
      server_height = 0,
      connected = true,
      version = "0.0.0",
      default_wallet = "/",
      fee_per_kb = 0,
      spv_nodes = 0
    } = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getinfo", "params": [] }, crypto)

    const {
      confirmed = 0,
      unconfirmed = 0
    } = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getbalance", "params": [] }, crypto)

    const getservers = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getservers", "params": [] }, crypto)

    res.render("index", {
      domain: req.headers.host,
      path,
      server,
      blockchain_height,
      server_height,
      connected,
      version,
      default_wallet,
      spv_nodes,
      fee_per_kb,
      confirmed,
      unconfirmed,
      servers: Object.keys(getservers).map(host => {
        return {
          host,
          pruning: getservers[host].pruning ?? "-",
          version: getservers[host].version ?? "-",
          ssl: getservers[host].s ?? "-",
          tcp: getservers[host].t ?? "-",
        }
      }),
      crypto: getCryptoShortened(crypto),
      basePath: crypto
    });
  })

  app.get(`/${crypto}/unspent`, async (req, res) => {
    const listunspent = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "listunspent", "params": [] }, crypto)

    res.render("unspent", {
      domain: req.headers.host,
      total: listunspent.length ? listunspent.reduce((acc, { value }) => acc+parseFloat(value), 0) : 0,
      listunspent: listunspent.length ? listunspent : [],
      crypto: getCryptoShortened(crypto),
      basePath: crypto
    });
  })
})

app.get("/ethereum", async (req, res) => {
  const {
    addresses,
    balances,
    transactionsReceived
  } = await ethereumGetDashboardDetails()

  res.render("ethereum", {
    domain: req.headers.host,
    addresses,
    balances,
    transactionsReceived,
    crypto: getCryptoShortened("ethereum"),
    basePath: "ethereum"
  });
})

const port = process.env.port || 3000
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
