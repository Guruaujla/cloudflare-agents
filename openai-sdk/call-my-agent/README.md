# Call My Agent

Let's make an agent that you can make a phone call to! Powered by the OpenAI agents sdk and Twilio.

## Optional end-to-end encryption

To enable [RealtimeKit](https://github.com/openai/openai-realtime) end-to-end encryption, set the `REALTIMEKIT_E2EE` environment variable to `true` before deploying. Encryption adds a small amount of processing overhead, which may introduce additional latency on lower-powered devices or congested networks.
