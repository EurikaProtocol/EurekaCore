import { TINAN_TOKEN } from '../config/tinan-token';
import type { TokenSnapshot } from './token-reader';

export async function addTokenToWallet(token: Pick<TokenSnapshot, 'address' | 'symbol' | 'decimals'>) {
  if (!window.ethereum) {
    window.alert('No compatible injected EVM wallet was found.');
    return;
  }
  if (!TINAN_TOKEN.chainId) {
    window.alert('Set the token network before adding this token to a wallet.');
    return;
  }
  try {
    const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
    if (typeof currentChain !== 'string' || Number.parseInt(currentChain, 16) !== TINAN_TOKEN.chainId) {
      window.alert(`Switch your wallet to ${TINAN_TOKEN.networkName} before adding this token.`);
      return;
    }
    const accepted: unknown = await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: { address: token.address, symbol: token.symbol, decimals: token.decimals },
      },
    });
    if (accepted !== true) window.alert('The wallet did not confirm adding this token.');
  } catch {
    window.alert('The wallet could not add this token. No transaction was sent.');
  }
}
