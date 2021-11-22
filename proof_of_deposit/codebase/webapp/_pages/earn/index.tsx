import { Link } from 'react-router-dom';
import Image from 'next/image';
import {
  Panel,
  PanelDescription,
  PanelWithButton,
  PanelHeader,
  Table,
} from '../../components';
import { tokens } from '../../constants';
import { Base } from '../../state';
import { formatAmount } from '../../utils';

export function Earn() {
  const {
    fetchingBalances,
    balances,
  } = Base.useContainer();

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

        <div className="-mx-5">
          <Table
            headers={[
              '',
              'Ticker',
              'Market APY',
              'Locked (Voting %)',
              'Unlocking (Ready %)',
            ]}
            noDataMessage="No validator groups found"
            loading={fetchingBalances}
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
                      5.00
                    </span>
                    %
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
        </div>

        <button
          className="ml-auto primary-button"
        >
          Distribute 1 CELO
        </button>
      </PanelWithButton>
    </>
  );
}
