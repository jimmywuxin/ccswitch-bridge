export function modelsHandler(req, res, model) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    object: "list",
    data: [{ id: model, object: "model", created: 1720000000, owned_by: "ccswitch-bridge" }]
  }));
}
