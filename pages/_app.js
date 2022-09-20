import '../styles/globals.css';
import { Web3ReactProvider } from '@web3-react/core';
import Web3 from 'web3';
import { ethers } from 'ethers';
import { Web3Provider } from '@ethersproject/providers';
function getLibrary(provider) {
	const library = new Web3Provider(provider);
	library.pollingInterval = 12000;
	return library;
}

function MyApp({ Component, pageProps }) {
	return (
		<Web3ReactProvider getLibrary={getLibrary}>
			<Component {...pageProps} />
		</Web3ReactProvider>
	);
}

export default MyApp;
