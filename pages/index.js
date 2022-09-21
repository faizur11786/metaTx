import Head from 'next/head';
import Image from 'next/image';
import styles from '../styles/Home.module.css';
import Web3 from 'web3';
import { useEffect, useState } from 'react';
import Web3WsProvider from 'web3-providers-ws';
import { useWeb3React } from '@web3-react/core';
import { injected } from '../connectors';

import forwarderAbi from '../abi/Forwarder.json';
import registryAbi from '../abi/Registry.json';
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

export default function Home() {
	const { activate, library, account } = useWeb3React();
	const [forwarderContract, setForwarderContract] = useState(null);
	const [registryContract, setRegistryContract] = useState(null);
	const [registers, setRegisters] = useState(null);

	const [signature, setSignature] = useState(null);
	const [request, setRequest] = useState(null);

	const getInstance = async (address, abi) => {
		const provider = new ethers.providers.Web3Provider(library.provider);
		const contract = new ethers.Contract(address, abi, provider.getSigner());
		return contract;
	};

	useEffect(() => {
		(async () => {
			if (library && account) {
				const forwarderCon = await getInstance('0x4DA46bA4DBE3c49b51Fea12E1D9Ae71021768Db0', forwarderAbi);
				setForwarderContract(forwarderCon);
				const registryCon = await getInstance('0xf6182B90EF0feD5b838918e7eD0bEa3159577b0C', registryAbi);
				setRegistryContract(registryCon);
			}
		})();
	}, [library, account]);

	const [message, setMessage] = useState('');

	// Sign Trasaction (eth_signTypedData_v4)
	const signTypedData = async () => {
		const data = registryContract.interface.encodeFunctionData('register', [message]);
		const gas = await registryContract.estimateGas.register(message);
		const nonce = await forwarderContract.getNonce(account).then((nonce) => nonce.toString());
		const buildSignObject = {
			types: {
				EIP712Domain,
				ForwardRequest,
			},
			domain: {
				name: 'MinimalForwarder',
				version: '0.0.1',
				chainId: 80001,
				verifyingContract: '0x4DA46bA4DBE3c49b51Fea12E1D9Ae71021768Db0',
			},
			primaryType: 'ForwardRequest',
			message: {
				from: account,
				to: registryContract.address,
				value: 0,
				gas: gas.toString(),
				nonce,
				data,
			},
		};

		const signature = await library.provider.request({
			method: 'eth_signTypedData_v4',
			params: [account, JSON.stringify(buildSignObject)],
			from: account,
		});
		setSignature(signature);
		setRequest(buildSignObject.message);

		return { signature, request: buildSignObject.message };
	};

	// Track events and react saved Quotes
	useEffect(() => {
		(async () => {
			if (registryContract) {
				const filters = await registryContract.filters.Registered();
				registryContract.queryFilter(filters, 28184935, 'latest').then((events) => {
					let registers = [];
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
	}, [registryContract]);

	// Execute signed transaction with difrent account
	const execute = async () => {
		try {
			console.log('executing with...', request, signature);
			const tx = await forwarderContract.execute(request, signature);
			console.log(tx);
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
						<button style={{ padding: '0.5rem' }} onClick={signTypedData}>
							Save
						</button>
					</div>
				)}

				{signature && request && <button onClick={execute}>Execute</button>}
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
