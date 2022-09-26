import { useWeb3React } from '@web3-react/core';
import { ethers } from 'ethers';
import React, { useEffect, useState } from 'react';
import { injected, tokens } from '../connectors';

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

const AddLiquidity = () => {
	const ERC_20_ABI = [
		{
			constant: true,
			inputs: [],
			name: 'name',
			outputs: [{ name: '', type: 'string' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: false,
			inputs: [
				{ name: '_spender', type: 'address' },
				{ name: '_value', type: 'uint256' },
			],
			name: 'approve',
			outputs: [{ name: '', type: 'bool' }],
			payable: false,
			stateMutability: 'nonpayable',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'totalSupply',
			outputs: [{ name: '', type: 'uint256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: false,
			inputs: [
				{ name: '_from', type: 'address' },
				{ name: '_to', type: 'address' },
				{ name: '_value', type: 'uint256' },
			],
			name: 'transferFrom',
			outputs: [{ name: '', type: 'bool' }],
			payable: false,
			stateMutability: 'nonpayable',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'decimals',
			outputs: [{ name: '', type: 'uint8' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [{ name: '_owner', type: 'address' }],
			name: 'balanceOf',
			outputs: [{ name: 'balance', type: 'uint256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'symbol',
			outputs: [{ name: '', type: 'string' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: false,
			inputs: [
				{ name: '_to', type: 'address' },
				{ name: '_value', type: 'uint256' },
			],
			name: 'transfer',
			outputs: [{ name: '', type: 'bool' }],
			payable: false,
			stateMutability: 'nonpayable',
			type: 'function',
		},
		{
			constant: true,
			inputs: [
				{ name: '_owner', type: 'address' },
				{ name: '_spender', type: 'address' },
			],
			name: 'allowance',
			outputs: [{ name: '', type: 'uint256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{ payable: true, stateMutability: 'payable', type: 'fallback' },
		{
			anonymous: false,
			inputs: [
				{ indexed: true, name: 'owner', type: 'address' },
				{ indexed: true, name: 'spender', type: 'address' },
				{ indexed: false, name: 'value', type: 'uint256' },
			],
			name: 'Approval',
			type: 'event',
		},
		{
			anonymous: false,
			inputs: [
				{ indexed: true, name: 'from', type: 'address' },
				{ indexed: true, name: 'to', type: 'address' },
				{ indexed: false, name: 'value', type: 'uint256' },
			],
			name: 'Transfer',
			type: 'event',
		},
	];
	const [values, setValues] = useState({
		token: '',
		amount: '',
	});
	const [signature, setSignature] = useState(null);
	const [request, setRequest] = useState(null);

	const [balance, setBalance] = useState('');
	const [allowance, setAllowance] = useState('');

	const { activate, library, account } = useWeb3React();

	useEffect(() => {
		(() => activate(injected))();
	}, []);

	const getInstance = async (address, abi) => {
		const provider = new ethers.providers.Web3Provider(library.provider);
		const contract = new ethers.Contract(address, abi, provider.getSigner());
		return contract;
	};

	const submitHandler = async () => {
		console.log('submitHandler', values);

		const token = await getInstance(values.token, ERC_20_ABI);
		setBalance(ethers.utils.formatUnits(await token.balanceOf(account), await token.decimals()));
	};

	const signData = async () => {
		if (account && values.token) {
			const Forwarder = require('../abi/Forwarder.json');
			const forwarder = await getInstance(Forwarder.address, Forwarder.abi);

			const Wallet = require('../abi/Wallet.json');
			const wallet = await getInstance(Wallet.address, Wallet.abi);
			const token = await getInstance(values.token, ERC_20_ABI);

			const decimals = await token.decimals();
			setBalance(ethers.utils.formatUnits(await token.balanceOf(account), decimals));

			const data = token.interface.encodeFunctionData('approve', [
				wallet.address,
				ethers.utils.parseUnits(values.amount, decimals),
			]);
			const gas = await token.estimateGas
				.approve(wallet.address, ethers.utils.parseUnits(values.amount, decimals))
				.then((gas) => gas.toString());
			const nonce = await forwarder.getNonce(account).then((nonce) => nonce.toString());

			const chainId = await forwarder.provider.getNetwork().then((n) => n.chainId);
			const typeData = getMetaTxTypeData(chainId, forwarder.address);
			const request = {
				from: account,
				to: token.address,
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
			const Forwarder = require('../abi/Forwarder.json');
			const forwarder = await getInstance(Forwarder.address, Forwarder.abi);
			const tx = await forwarder.execute(request, signature);
			console.log('tx', tx);
			const recepit = await tx.wait();
			console.log('recepit', recepit);
		} catch (error) {
			console.log('error', error);
		}
	};

	const getAllowance = async () => {
		const token = await getInstance(values.token, ERC_20_ABI);

		const Wallet = require('../abi/Wallet.json');
		const wallet = await getInstance(Wallet.address, Wallet.abi);
		setAllowance(ethers.utils.formatUnits(await token.allowance(account, wallet.address), await token.decimals()));
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
							Token A
						</label>
						<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
							<select
								onChange={(e) => {
									setValues({ ...values, token: e.target.value });
								}}
								name='token'
								id='token'
								style={{ width: '100%', padding: '0.5rem 1rem' }}
							>
								{tokens.map((token, index) => (
									<option value={token.address} key={index}>
										{token.name}
									</option>
								))}
							</select>
							<div>
								<input
									onChange={(e) => {
										setValues({ ...values, amount: e.target.value });
									}}
									type='number'
									placeholder='value'
									style={{ width: '100%', padding: '0.5rem 1rem' }}
								/>
								{balance && <span style={{ fontSize: '12px' }}>{balance}</span>}
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
						<button onClick={getAllowance} style={{ padding: '0.5rem 1rem', width: '100%' }}>
							Get Allowance {allowance && allowance}
						</button>
					</div>
					<div>
						<button onClick={submitHandler} style={{ padding: '0.5rem 1rem', width: '100%' }}>
							Add Liquidity
						</button>
					</div>
				</div>
			</div>
		</>
	);
};

export default AddLiquidity;
