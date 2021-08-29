const express = require("express")
const fetch = require("node-fetch")
const fs = require("fs")
const path = require("path")
const app = express()

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

const getCryptoShortened = (crypto) => {
  const cryptos = {
    "bitcoin": "BTC",
    "litecoin": "LTC",
    "bitcoin-cash": "BCH"
  }
  return cryptos[crypto]
}

app.get("/", (req, res) => {
  res.json({
    "paths": [
      "/bitcoin",
      "/litecoin",
      "/bitcoin-cash"
    ]
  })
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

const port = process.env.port || 3000
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
