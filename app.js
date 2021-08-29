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
  return json.result
}

const getCryptoShortened = (crypto) => {
  const cryptos = {
    "bitcoin": "BTC",
    "litecoin": "LTC",
    "bitcoin-cash": "BCH"
  }
  return cryptos[crypto]
}

[
  "bitcoin",
  "litecoin",
  "bitcoin-cash"
].forEach(crypto => {
  app.get(`/${crypto}`, async (req, res) => {
    const getinfo = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getinfo", "params": [] }, crypto)
    const getbalance = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getbalance", "params": [] }, crypto)
    const getservers = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getservers", "params": [] }, crypto)

    res.render("index", {
      domain: req.headers.host,
      ...getinfo,
      ...getbalance,
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
      total: listunspent.reduce((acc, { value }) => acc+parseFloat(value), 0),
      listunspent,
      crypto: getCryptoShortened(crypto),
      basePath: crypto
    });
  })
})

const port = process.env.port || 3000
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
