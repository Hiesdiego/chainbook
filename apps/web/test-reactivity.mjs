// test-reactivity.mts
import { SDK } from '@somnia-chain/reactivity';
import { createPublicClient, webSocket, defineChain } from 'viem';
var chain = defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
    rpcUrls: {
        default: {
            http: ['https://dream-rpc.somnia.network'],
            webSocket: ['wss://dream-rpc.somnia.network/ws'],
        },
    },
});
var client = createPublicClient({
    chain: chain,
    transport: webSocket('wss://dream-rpc.somnia.network/ws'),
});
var sdk = new SDK({ public: client });
console.log('Subscribing (no topicOverrides — pure wildcard)...');
var sub = await sdk.subscribe({
    ethCalls: [],
    onData: function (d) { return console.log('GOT DATA:', JSON.stringify(d)); },
    onError: function (e) { return console.error('ERROR:', e); },
});
console.log('Subscribed. Waiting 60s for any event...');
setTimeout(function () {
    console.log('60s elapsed — no data received. Endpoint does not push Reactivity events.');
    process.exit(0);
}, 60000);
