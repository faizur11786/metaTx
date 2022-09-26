import { InjectedConnector } from '@web3-react/injected-connector';

export const injected = new InjectedConnector({
	supportedChainIds: [137, 80001, 31337, 1337, 56, 97],
});

// export const tokens = [
// 	{
// 		address: '0x96c9748060309874e483039E43faf526eC8F30b3',
// 		name: 'BUSD',
// 	},
// 	{
// 		address: '0x9a7B232AE8A96712Fb6Cb9bC269001FAc8B120Fb',
// 		name: 'USDT',
// 	},
// 	{
// 		address: '0xeA0476D327e1e9F4d39EB81c6df94823055C85b0',
// 		name: 'USDC',
// 	},
// 	{
// 		address: '0x564c4C6FA8994f3f4C1eE9e61193cc093cdb98Fe',
// 		name: 'M4U',
// 	},
// ];
