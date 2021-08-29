const express = require("express")
const fetch = require("node-fetch")
const path = require("path")
const app = express()

app.set("views", path.join(__dirname, "/pages"))
app.set("view engine", "ejs")

const {
  rpcUser,
  rpcPassword,
  rpcHost,
  rpcPort,
  crypto
} = process.env

const rpcRequest = async (body) => {
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

app.get('/', async (req, res) => {
  const getinfo = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getinfo", "params": [] })
  const getbalance = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getbalance", "params": [] })
  const getservers = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "getservers", "params": [] })

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
    crypto
  });
})

app.get("/unspent", async (req, res) => {
  const listunspent = await rpcRequest({"jsonrpc": "1.0", "id":"curl", "method": "listunspent", "params": [] })

  res.render("unspent", {
    domain: req.headers.host,
    total: listunspent.reduce((acc, { value }) => acc+parseFloat(value), 0),
    listunspent,
    crypto
  });
})

const port = process.env.port || 3000
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
