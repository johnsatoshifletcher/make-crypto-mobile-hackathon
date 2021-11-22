import { useContractKit } from '@celo-tools/use-contractkit';
import { ContractKit } from '@celo/contractkit';
import { GroupVote } from '@celo/contractkit/lib/wrappers/Election';
import { ValidatorGroup } from '@celo/contractkit/lib/wrappers/Validators';
import { BigNumber } from 'bignumber.js';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Loader from 'react-loader-spinner';
import Web3 from 'web3';
import Image from 'next/image';
import {
  Bold,
  CopyText,
  CustomSelectSearch,
  LockToken,
  Panel,
  PanelDescription,
  PanelGrid,
  PanelHeader,
  Table,
  toast,
  TokenInput,
} from '../../components';
import { tokens } from '../../constants';
import { Base } from '../../state';
import { formatAmount, truncate, truncateAddress } from '../../utils';

enum States {
  None,
  Activating,
  Revoking,
  Locking,
  Unlocking,
  Voting,
}

export function EarnToken() {
  const { token: tokenTicker } = useParams();
  const token = tokens.find(
    (t) =>
      t.ticker.toLowerCase() === ((tokenTicker as string) || '').toLowerCase()
  );

  const { kit, performActions, address } = useContractKit();
  const {
    lockedSummary,
    fetchLockedSummary,
    balances,
    track,
  } = Base.useContainer();

  const balance = balances[token.ticker];
  const total_locked = balance.total_locked;
  const voting_pct = total_locked.minus(balance.nonvoting_locked).dividedBy(total_locked).times(100);
  const total_unlocking = balance.unlocking;
  const withdrawable_pct = balance.withdrawable.dividedBy(total_unlocking).times(100);

  return (
    <>
      <Panel>
        <PanelHeader>Earn with {token.ticker}</PanelHeader>
        <PanelDescription>
          When locking {token.ticker} it's important to note that there are a few
          states your {token.ticker} can be in, available, locked (voting or non-voting), and unlocking (pending or ready to withdraw). 
          Proof-of-deposit is based on the same mechanism as LockedGold, checkout
          the{' '}
          <Link link="https://docs.celo.org/celo-codebase/protocol/proof-of-stake/locked-gold">
            LockedGold documentation
          </Link>
        </PanelDescription>
        <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm mt-2"></p>

        <div>
          <dl className="grid grid-cols-1 rounded-lg bg-white dark:bg-gray-700 overflow-hidden shadow divide-y divide-gray-200 md:grid-cols-3 md:divide-y-0 md:divide-x">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-base font-medium text-gray-600 dark:text-gray-200">
                Available
              </dt>
              <dd className="mt-1 flex justify-between items-baseline md:block lg:flex">     
                <div className="flex items-baseline text-2xl font-semibold text-indigo-600 dark:text-indigo-300">
                  <Image
                      height="18px"
                      width="18px"
                      src={`/tokens/${token.ticker}.png`}
                    />
                  <div className="px-2">
                    {formatAmount(balances[token.ticker].balance)}
                  </div>
                </div>
              </dd>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-base font-medium text-gray-600 dark:text-gray-200">
                Locked (Voting %)
              </dt>
              <dd className="mt-1 flex justify-between items-baseline md:block lg:flex">     
                <div className="flex items-baseline text-2xl font-semibold text-indigo-600 dark:text-indigo-300">
                  <Image
                      height="18px"
                      width="18px"
                      src={`/tokens/${token.ticker}.png`}
                    />
                  <div className="px-2">
                    {formatAmount(total_locked)} ({voting_pct.isNaN() ? '0' : voting_pct.toFixed(0)} %)
                  </div>
                </div>
              </dd>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-base font-medium text-gray-600 dark:text-gray-200">
                Unlocking (Ready %)
              </dt>
              <dd className="mt-1 flex justify-between items-baseline md:block lg:flex">     
                <div className="flex items-baseline text-2xl font-semibold text-indigo-600 dark:text-indigo-300">
                  <Image
                      height="18px"
                      width="18px"
                      src={`/tokens/${token.ticker}.png`}
                    />
                  <div className="px-2">
                    {formatAmount(total_unlocking)} ({withdrawable_pct.isNaN() ? '0' : withdrawable_pct.toFixed(0)} %)
                  </div>
                </div>
              </dd>
            </div>
          </dl>
        </div>
      </Panel>

      <LockToken token={token}/>
    </>
  );
}
