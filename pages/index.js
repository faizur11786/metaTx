import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { useEffect, useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import { injected } from '../connectors';
import Forwarder from '../abi/Forwarder.json';
import Registry from '../abi/Registry.json';
// import Forwarder from '../abi/MinimalForwarder.json';
// import Registry from '../abi/RegistryV2.json';
import { ethers } from 'ethers';

const EIP712Domain = [
	{ name: 'name', type: 'string' },
	{ name: 'version', type: 'string' },
	{ name: 'chainId', type: 'uint256' },
	{ name: 'verifyingContract', type: 'address' },
];

const ForwardRequest = [
	{ name: 'from', type: 'address' },
	{ name: 'to', type: 'address' },
	{ name: 'value', type: 'uint256' },
	{ name: 'gas', type: 'uint256' },
	{ name: 'nonce', type: 'uint256' },
	{ name: 'data', type: 'bytes' },
];
function getMetaTxTypeData(chainId, verifyingContract) {
	return {
		types: {
			EIP712Domain,
			ForwardRequest,
		},
		domain: {
			name: 'Forwarder',
			version: '1',
			chainId,
			verifyingContract,
		},
		primaryType: 'ForwardRequest',
	};
}

export default function Home() {
	const { activate, library, account } = useWeb3React();

	const [registers, setRegisters] = useState(null);
	const [signature, setSignature] = useState(null);
	const [request, setRequest] = useState(null);
	const [message, setMessage] = useState('');
	const [contract, setContract] = useState({
		forwarder: null,
		registry: null,
	});
	const getInstance = async (address, abi, name) => {
		const provider = new ethers.providers.Web3Provider(library.provider);
		const contract = new ethers.Contract(address, abi, provider.getSigner());
		setContract((previous) => ({ ...previous, [name]: contract }));
		return contract;
	};

	useEffect(() => {
		(async () => {
			if (account) {
				await getInstance(Forwarder.address, Forwarder.abi, 'forwarder');
				await getInstance(Registry.address, Registry.abi, 'registry');
			}
		})();
	}, [account]);

	useEffect(() => {
		() => activate(injected);
	}, []);

	// Track events and react saved Quotes
	useEffect(() => {
		(async () => {
			if (contract.registry) {
				const filters = await contract.registry.filters.Registered();
				console.log('filters', filters);
				contract.registry.queryFilter(filters, 28304065, 'latest').then((events) => {
					let registers = [];
					console.log('events', events);
					events.forEach((event) => {
						registers.push({
							name: event.args.name,
							who: event.args.who,
						});
					});
					setRegisters(registers);
				});
			}
		})();
	}, [contract.registry, account]);

	const signData = async () => {
		if (account && message) {
			const { token, forwarder, registry } = contract;
			const data = registry.interface.encodeFunctionData('register', [message]);
			const gas = await registry.estimateGas.register(message).then((gas) => gas.toString());
			const nonce = await forwarder.getNonce(account).then((nonce) => nonce.toString());
			const chainId = await forwarder.provider.getNetwork().then((n) => n.chainId);
			const typeData = getMetaTxTypeData(chainId, forwarder.address);
			const request = {
				from: account,
				to: registry.address,
				value: 0,
				gas,
				nonce,
				data,
			};
			const toSign = {
				...typeData,
				message: request,
			};
			console.log('toSign', toSign);
			const signature = await library.provider.request({
				method: 'eth_signTypedData_v4',
				params: [account, JSON.stringify(toSign)],
				from: account,
			});
			setSignature(signature);
			setRequest(toSign.message);
		} else {
			console.error('account or token not found');
		}
	};

	const executeMetaTx = async () => {
		try {
			console.log('executing with...', request, signature);
			const { forwarder } = contract;
			const tx = await forwarder.execute(request, signature);
			console.log('tx', tx);
			const recepit = await tx.wait();
			console.log('recepit', recepit);
		} catch (error) {
			console.log('error', error);
		}
	};

	return (
		<div className={styles.container}>
			<Head>
				<title>Meta Tx</title>
				<meta name='description' content='Meta Tx' />
				<link rel='icon' href='/favicon.ico' />
			</Head>
			<div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 0' }}>
				{account && <button style={{ padding: '0.5rem' }}>{account}</button>}
			</div>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100vh',
				}}
			>
				{account && (
					<div style={{ marginTop: '-15rem' }}>
						<input
							onChange={(e) => setMessage(e.target.value)}
							type='text'
							style={{ width: '400px', padding: '0.5rem', outline: 'none' }}
						/>
						<button style={{ padding: '0.5rem' }} onClick={signData}>
							Save
						</button>
					</div>
				)}

				{signature && request && <button onClick={executeMetaTx}>Execute</button>}
				{registers && (
					<div style={{ marginTop: '1rem' }}>
						{registers.map((register, index) => {
							return (
								<div key={index} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
									<p>{register.name}</p>
									<span>{'==>'}</span>
									<p>{register.who}</p>
								</div>
							);
						})}
					</div>
				)}
				{!account && <button onClick={() => activate(injected)}>Connect with Metamask</button>}
			</div>
		</div>
	);
}
