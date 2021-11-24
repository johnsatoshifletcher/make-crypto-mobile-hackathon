import { useContractKit } from '@celo-tools/use-contractkit';
import { useState, useCallback, useEffect } from 'react';
import useStateRef from 'react-usestateref';
import { Link } from 'react-router-dom';
import Loader from 'react-loader-spinner';
import Image from 'next/image';
import {
  Panel,
  PanelDescription,
  PanelWithButton,
  PanelHeader,
  Table,
  toast
} from '../../components';
import Web3 from 'web3';
import { tokens, Celo, LockedERC20 } from '../../constants';
import { Base } from '../../state';
import { formatAmount, Election, electionAddress } from '../../utils';
import ERC20 from '../../utils/abis/ERC20.json';
import { BigNumber } from 'bignumber.js';
import { eqAddress } from '@celo/base';

enum States {
  None,
  Distributing
}

export function Earn() {
  const {
    accountSummary,
    accountSummaryRef,
    balances,
  } = Base.useContainer();

  const { kit, network, performActions, address } = useContractKit();

  const [epochRewards, setEpochRewards] = useState(
    tokens.reduce((prev, t) => {
      return {
        ...prev,
        [t.ticker]: {
          rewards: new BigNumber(0), 
          apy: new BigNumber(0),
          total_votes: new BigNumber(0)
        }
      };
    }, {}
  ));
  const [loading, setLoading, loadingRef] = useStateRef(false);
  const [state, setState] = useState(States.None);

  const distribute = async () => {
    setState(States.Distributing);
    try {
      await performActions(async (k) => {   
        const cgld = new k.web3.eth.Contract(
          ERC20 as any,
          Celo.networks[network.name]
        );       

        const allowance = new BigNumber(Web3.utils.toWei("1000"));
        const min_allowance = new BigNumber(Web3.utils.toWei("1"));
        await k.sendTransactionObject(
          await cgld.methods.approve(electionAddress, allowance),
          { from: address }
        );          

        while(true){
          if(min_allowance.lte(await cgld.methods.allowance(address, electionAddress).call())) {
            break;
          }
          await new Promise(r => setTimeout(r, 1000));
        }

        const election = new Election(k, "0x0", address);
        await election.distributeEpochRewards(new BigNumber(Web3.utils.toWei("1")));
      });
      toast.success('Rewards distributed');
    } catch (e) {
      toast.error(`Unable to distribute rewards ${e.message}`);
    } finally {
      setState(States.None);
    }
  };

  const fetchEpochRewards = useCallback(async () => {
    if (loadingRef.current) {
      return;
    }
    setLoading(true);

    const address = accountSummaryRef.current.address;
    const rewards = await Promise.all(
      tokens.map(async (t) => {
        const election = new Election(kit, LockedERC20[t.ticker].address, address);
        return election.getEpochTokenRewards(new BigNumber(Web3.utils.toWei("1")));
      })
    );
    const total_votes = await Promise.all(
      tokens.map(async (t) => {
        const election = new Election(kit, LockedERC20[t.ticker].address, address);
        return election.getTotalVotes();
      })
    );
    const epochs_per_year = new BigNumber("365");

    const _epochRewards = tokens.reduce((prev, t, i) => {
        return {
          ...prev,
          [t.ticker]: {
            rewards: rewards[i],
            apy: epochs_per_year.times(rewards[i]).div(total_votes[i]).times(100),
            total_votes: total_votes[i]
          }
        };
      }, {}
    );

    setEpochRewards(_epochRewards);
    setTimeout(fetchEpochRewards, 1000);
  }, [kit, address, accountSummary]);

  useEffect(() => {
    fetchEpochRewards();
  }, [fetchEpochRewards]);


  return (
    <>
      <Panel>
        <PanelHeader>Earn with Proof-of-Deposit</PanelHeader>
        <PanelDescription>
          In Proof-of-Deposit, you can earn passive rewards on your CELO, cSUD and/or cEUR.
          To begin you need to first locked your tokens, then you're free to vote for
          validator groups of your choosing.
        </PanelDescription>
        <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm mt-2"></p>

        <div>
          <dl className="grid grid-cols-1 rounded-lg bg-white dark:bg-gray-700 overflow-hidden shadow divide-y divide-gray-200 md:grid-cols-3 md:divide-y-0 md:divide-x">
            {Object.keys(balances)
              .map((ticker) => {
                const token = tokens.find((t) => t.ticker === ticker);
                return [
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-base font-medium text-gray-600 dark:text-gray-200">
                        Available {token.ticker}
                      </dt>
                      <dd className="mt-1 flex justify-between items-baseline md:block lg:flex">     
                        <div className="flex items-baseline text-2xl font-semibold text-indigo-600 dark:text-indigo-300">
                          <Image
                              height="18px"
                              width="18px"
                              src={`/tokens/${ticker}.png`}
                            />
                          <div className="px-2">
                            {formatAmount(balances[token.ticker].balance)}
                          </div>
                        </div>
                      </dd>
                    </div>
                ];
              })}
          </dl>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>Lockable Tokens</PanelHeader>
        <PanelDescription>
          The Market APY and Epoch Rewards for lockable tokens are calculated based on 1 CELO per epoch{' '}
          and 365 epochs per year with the rewards being divided amongst locked tokens in the following configurable{' '}
          proportion:
          <ul className="list-inside list-disc mb-1">
            <li>
              CELO - 50%
            </li>
            <li>
              cUSD - 25%
            </li>
            <li>
              cEUR - 25%
            </li>
          </ul> 
          <p>
          The proportion of CELO epoch rewards paid to cUSD and cEUR are coverted into{' '}
          their respective currency via <a href="https://ubeswap.org/" className="text-blue-500">Ubeswap</a>. 
          </p>
        </PanelDescription>

        <div className="-mx-5">
          <Table
            headers={[
              '',
              'Ticker',
              'Market APY',
              'Epoch Rewards',
              'Total Votes',
              'Locked (Voting %)',
              'Unlocking (Ready %)',
            ]}
            noDataMessage="No validator groups found"
            loading={false}
            rows={Object.keys(balances)
              .map((ticker) => {
                const total_locked = balances[ticker].total_locked;
                const voting_pct = total_locked.minus(balances[ticker].nonvoting_locked).dividedBy(total_locked).times(100);
                const total_unlocking = balances[ticker].unlocking;
                const withdrawable_pct = total_unlocking.dividedBy(total_unlocking).times(100);
                return [
                  <Link to={`/earn/${ticker}`}>
                    <span className="px-4 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-50 dark:hover:bg-gray-300 text-white dark:text-gray-800 transition  rounded">
                      Manage
                    </span>
                  </Link>,
                  <div className="flex items-center space-x-2">
                    <span style={{ minWidth: '20px' }}>
                      <Image
                        src={`/tokens/${ticker}.png`}
                        height={20}
                        width={20}
                        className="rounded-full"
                      />
                    </span>
                    <div>{ticker}</div>
                  </div>,
                  <div>
                    <span className="text-green-500 mr-1">
                      {epochRewards[ticker].apy.toFixed(2)}
                    </span>
                    %
                  </div>,
                  <div>
                    <span className="text-green-500 mr-1">
                      {formatAmount(epochRewards[ticker].rewards)}
                    </span>
                  </div>,
                  <div className="font-semibold">
                    {formatAmount(epochRewards[ticker].total_votes)}
                  </div>,
                  <div className="font-semibold">
                    {formatAmount(total_locked)} ({voting_pct.isNaN() ? '0' : voting_pct.toFixed(0)} %)
                  </div>,
                  <div className="font-semibold">
                    {formatAmount(total_unlocking)} ({withdrawable_pct.isNaN() ? '0' : withdrawable_pct.toFixed(0)} %)
                  </div>,
              ];
            })}
          />
        </div>
      </Panel>

      <PanelWithButton>
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
            Simulate Epoch Rewards
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
            By pressing the button, your wallet will transfer 1 CELO to the election smart contract,{' '}
            whereupon it will be divided amongst lockable tokens as a simulated epoch reward.
          </p>
        </div>

        <button
          className="ml-auto primary-button"
          onClick={distribute}
        >
          {state === States.Distributing ? (
            <Loader type="TailSpin" height={20} width={20} />
          ) : (
            'Distribute 1 CELO'
          )}          
        </button>
      </PanelWithButton>
    </>
  );
}
