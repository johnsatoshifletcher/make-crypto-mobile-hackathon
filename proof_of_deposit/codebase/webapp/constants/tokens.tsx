import { NetworkNames } from '@celo-tools/use-contractkit';
import LockedCGLD from '../utils/abis/LockedCGLD.json';
import LockedCUSD from '../utils/abis/LockedCUSD.json';
import LockedCEUR from '../utils/abis/LockedCEUR.json';

export enum TokenTicker {
  CELO = 'CELO',
  cUSD = 'cUSD',
  cEUR = 'cEUR',
}

export const LockedERC20 = {
  [TokenTicker.CELO]: {
    contract: LockedCGLD,
    address: '0xBF6FA7D5f12CA97ad28597B98DD17E17071578c3'
  },
  [TokenTicker.cUSD]: {
    contract: LockedCUSD,
    address: '0xA227e51477819001C6871e5F60ecc8E0311E3596'
  },
  [TokenTicker.cEUR]: {
    contract: LockedCEUR,
    address: '0xdc056904fa87De51dd11503410a9E6804881fED0'
  },
};

export interface Token {
  ticker: TokenTicker;
  name: string;
  networks: {
    [key in NetworkNames]?: string;
  };
}

export const Celo: Token = {
  ticker: TokenTicker.CELO,
  name: 'Celo',
  networks: {
    [NetworkNames.Alfajores]: '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9',
    [NetworkNames.Mainnet]: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    [NetworkNames.Baklava]: '0xdDc9bE57f553fe75752D61606B94CBD7e0264eF8',
  },
};
export const cUSD: Token = {
  ticker: TokenTicker.cUSD,
  name: 'Celo Dollar',
  networks: {
    [NetworkNames.Alfajores]: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
    [NetworkNames.Mainnet]: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    [NetworkNames.Baklava]: '0x62492A644A588FD904270BeD06ad52B9abfEA1aE',
  },
};
export const cEUR: Token = {
  ticker: TokenTicker.cEUR,
  name: 'Celo Euro',
  networks: {
    [NetworkNames.Alfajores]: '0x10c892a6ec43a53e45d0b916b4b7d383b1b78c0f',
    [NetworkNames.Mainnet]: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
    [NetworkNames.Baklava]: '0xf9ecE301247aD2CE21894941830A2470f4E774ca',
  },
};

export const tokens: Token[] = [
  Celo,
  cUSD,
  cEUR
];

export enum FiatCurrency {
  USD = 'USD',
  EUR = 'EUR',
}
