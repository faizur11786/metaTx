import React, { useEffect, useState } from 'react';
import { injected } from '../connectors';
import { useWeb3React } from '@web3-react/core';
import Token from '../abi/Token.json';
import Forwarder from '../abi/MinimalForwarder.json';
import Registry from '../abi/RegistryV2.json';
// import Forwarder from '../abi/Forwarder.json';
// import Registry from '../abi/Registry.json';
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
const TokenPage = () => {
	const { activate, library, account } = useWeb3React();
	const [values, setValues] = useState();
	const [balance, setBalance] = useState('');
	const [registryBalance, setRegistryBalance] = useState('');
	const [address, setAddress] = useState('');
	const [signature, setSignature] = useState(null);
	const [request, setRequest] = useState(null);
	const [allowance, setAllowance] = useState('');

	const [contract, setContract] = useState({
		token: null,
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
		(() => activate(injected))();
	}, []);
	useEffect(() => {
		(async () => {
			if (account) {
				const token = await getInstance(Token.address, Token.abi, 'token');
				await getInstance(Forwarder.address, Forwarder.abi, 'forwarder');
				await getInstance(Registry.address, Registry.abi, 'registry');
				const allowance = await token.allowance(account, Registry.address);
				setAllowance(Number(allowance) / 1e18);
				const balance = await token.balanceOf(account);
				const registryBalance = await token.balanceOf(Registry.address);
				setRegistryBalance(Number(registryBalance) / 1e18);
				setBalance(Number(balance) / 1e18);
			}
		})();
	}, [account]);

	const signData = async () => {
		if ((account && values, address)) {
			const { token, forwarder, registry } = contract;

			const data = registry.interface.encodeFunctionData('transferFromToken', [
				token.address,
				account,
				address.toLowerCase(),
				ethers.utils.parseUnits(values, '18'),
			]);
			const gas = await registry.estimateGas
				.transferFromToken(token.address, account, address.toLowerCase(), ethers.utils.parseUnits(values, '18'))
				.then((gas) => gas.toString());
			const nonce = await forwarder.getNonce(account.toLowerCase()).then((nonce) => nonce.toString());
			const chainId = await forwarder.provider.getNetwork().then((n) => n.chainId);
			const typeData = getMetaTxTypeData(chainId, forwarder.address);
			const request = {
				from: account.toLowerCase(),
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
		<>
			<div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 0' }}>
				{account && <button style={{ padding: '0.5rem' }}>{account}</button>}
			</div>
			<div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
				<div style={{ padding: '1rem', width: '500px' }}>
					<div style={{ marginBottom: '2rem' }}>
						<label htmlFor='token' style={{ marginBottom: '0.5rem', display: 'block' }}>
							Enter Address
						</label>
						<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
							<div style={{ width: '100%' }}>
								<input
									onChange={(e) => {
										setAddress(e.target.value);
									}}
									type='text'
									placeholder='address'
									style={{ width: '100%', padding: '0.5rem 1rem' }}
								/>
							</div>
						</div>
					</div>
					<div style={{ marginBottom: '2rem' }}>
						<label htmlFor='token' style={{ marginBottom: '0.5rem', display: 'block' }}>
							Mint - Meta Token
						</label>
						<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
							<div style={{ width: '100%' }}>
								<input
									onChange={(e) => {
										setValues(e.target.value);
									}}
									type='number'
									placeholder='value'
									style={{ width: '100%', padding: '0.5rem 1rem' }}
								/>
								{balance && <span style={{ fontSize: '12px' }}>{balance}</span>}
								<br />
								{allowance && <span style={{ fontSize: '12px' }}>Allowance : {balance}</span>}
								<br />
								<span>Registry contract Balance: {registryBalance}</span>
							</div>
						</div>
					</div>
					<div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
						<button onClick={signData} style={{ padding: '0.5rem 1rem', width: '100%' }}>
							Sign Tx
						</button>
						{signature && request && (
							<button onClick={executeMetaTx} style={{ padding: '0.5rem 1rem', width: '100%' }}>
								Execute Tx
							</button>
						)}
					</div>
					<div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
						<button onClick={'getAllowance'} style={{ padding: '0.5rem 1rem', width: '100%' }}>
							Get Allowance
						</button>
					</div>
				</div>
			</div>
		</>
	);
};

export default TokenPage;
