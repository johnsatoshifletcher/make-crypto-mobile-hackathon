import { useContractKit } from '@celo-tools/use-contractkit';
import { useState } from 'react';
import Loader from 'react-loader-spinner';
import { toast } from '../components';
import { LockedERC20, Token } from '../constants';
import { Base } from '../state';
import { formatAmount, toWei, truncateAddress } from '../utils';
import { ensureAccount } from '../utils/ensure-account';
import { TokenInput } from './input';
import { Panel, PanelDescription, PanelGrid, PanelHeader } from './panel';
import { Bold, Link } from './text';
import ERC20 from '../utils/abis/ERC20.json';
import BigNumber from 'bignumber.js';

enum States {
  None,
  Activating,
  Revoking,
  Locking,
  Unlocking,
  Withdrawing,
}

export function LockToken({
  token
}: {
  token: Token;
}) {
  const { network, address, performActions } = useContractKit();
  const {
    lockedSummary,
    balances,
    track,
    fetchBalances,
  } = Base.useContainer();
  const [lockAmount, setLockAmount] = useState('');
  const [state, setState] = useState(States.None);

  const balance = balances[token.ticker];
  const tokenAddress = token.networks[network.name];

  const locked_erc20 = LockedERC20[token.ticker];

  const lock = async () => {
    track('lock/lock', { amount: toWei(lockAmount) });
    setState(States.Locking);

    try {
      await performActions(async (k) => {
        const erc20 = new k.web3.eth.Contract(
          ERC20 as any,
          tokenAddress
        );
        let txObject;
        const allowance = new BigNumber(toWei(lockAmount));
        txObject = await erc20.methods.approve(locked_erc20.address, allowance);
        await k.sendTransactionObject(txObject, { from: address });

        while(true){
          if(allowance.lte(await erc20.methods.allowance(address, locked_erc20.address).call())) {
            break;
          }
          await new Promise(r => setTimeout(r, 1000));
        }

        const contract = new k.web3.eth.Contract(
            locked_erc20.contract.abi as any,
            locked_erc20.address
        );
        txObject = await contract.methods.lock(toWei(lockAmount));
        await k.sendTransactionObject(txObject, { from: address });
      });
      await fetchBalances();
      toast.success(`${token.ticker} locked`);
      setLockAmount('');
    } catch (e) {
      toast.error(e.message);
    }
    setState(States.None);
  };

  const unlock = async () => {
    track('lock/unlock', { amount: toWei(lockAmount) });

    setState(States.Unlocking);
    try {
      await performActions(async (k) => {
        const contract = new k.web3.eth.Contract(
            locked_erc20.contract.abi as any,
            locked_erc20.address
        );
        let txObject;
        txObject = await contract.methods.unlock(toWei(lockAmount));
        await k.sendTransactionObject(txObject, { from: address });
      });
      await fetchBalances();
      toast.success(`${token.ticker} unlocked`);
      setLockAmount('');
    } catch (e) {
      toast.error(e.message);
    }
    setState(States.None);
  };

  const withdraw = async () => {
    track('lock/withdraw', { amount: toWei(lockAmount) });

    setState(States.Withdrawing);
    try {
      await performActions(async (k) => {
        const contract = new k.web3.eth.Contract(
            locked_erc20.contract.abi as any,
            locked_erc20.address
        );
        
        const currentTime = Math.round(new Date().getTime() / 1000);
        const pendingWithdrawals = await contract.methods.getPendingWithdrawals(address).call();
        for (let i = pendingWithdrawals[0].length - 1; i >= 0; i--) {
          let time = new BigNumber(pendingWithdrawals[1][i]);
          if (time.isLessThan(currentTime)) {
            let txObject = await contract.methods.withdraw(i);
            await k.sendTransactionObject(txObject, { from: address });
          }
        }
      });
      await fetchBalances();
      toast.success(`${token.ticker} withdrawn`);
    } catch (e) {
      toast.error(e.message);
    }
    setState(States.None);
  };

  return (
    <Panel>
      <PanelGrid>
        <PanelHeader>Lock {token.ticker}</PanelHeader>

        <div className="flex flex-col space-y-4">
          <PanelDescription>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              You currently have{' '}
              <Bold>{formatAmount(balance.balance)}</Bold> available,{' '}
              <Bold>{formatAmount(balance.total_locked)}</Bold> locked out of which{' '}
              <Bold>{formatAmount(balance.total_locked.minus(balance.nonvoting_locked))}</Bold> is voting, and{' '}
              <Bold>{formatAmount(balance.unlocking)}</Bold> unlocking out of which{' '}
              <Bold>{formatAmount(balance.withdrawable)}</Bold> is ready to withdraw.
            </p>
          </PanelDescription>
          <div>
            <span className="flex flex-col">
              <div className="w-full md:w-96 md:mx-auto">
                <TokenInput
                  value={lockAmount}
                  onChange={(e) => setLockAmount(e)}
                  token={token}
                />
              </div>
              {state === States.Locking || state === States.Unlocking ? (
                <div className="flex items-center justify-center mt-3">
                  <Loader
                    type="TailSpin"
                    color="white"
                    height="24px"
                    width="24px"
                  />
                </div>
              ) : (
                <div className="flex space-x-4 justify-center items-center">
                  <button className="secondary-button" onClick={unlock}>
                    Unlock
                  </button>
                  <button className="secondary-button" onClick={lock}>
                    Lock
                  </button>
                </div>
              )}

              {balance.withdrawable.gt(0) && (
                <div className="flex">
                  <button
                    className="secondary-button ml-auto"
                    onClick={withdraw}
                  >
                    Withdraw Locked {token.ticker}
                  </button>
                </div>
              )}
            </span>
          </div>
        </div>
      </PanelGrid>
    </Panel>
  );
}
