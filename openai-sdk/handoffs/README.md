# Agent Handoffs with SIP REFER

This example demonstrates how agents can transfer a caller to a human using a SIP `REFER` request.

```ts
// Pseudocode illustrating a transfer
if (needsHumanOperator(call)) {
  // Send REFER to switch control to a human endpoint
  sendSipRefer({
    referTo: "sip:operator@example.com",
    replaces: call.id
  });
  return; // agent relinquishes the call
}
```

The agent decides when to issue the `REFER`, and once acknowledged the call continues with the human endpoint. Error handling and retry logic are omitted for brevity.
