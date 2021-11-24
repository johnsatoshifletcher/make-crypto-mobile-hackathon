import { PanelWithButton, PanelDescription, PanelHeader } from '../components';
import Image from 'next/image';


export function Dashboard() {
  return (
    <>
      <PanelWithButton>
        <div className="justify-between space-x-3">
          <div>
            <PanelHeader>The Untapped Potential of Blockchain's Incentive Mechanism</PanelHeader>
            <PanelDescription>
              <b>Block rewards create a significant market for tokens (and may be the biggest by far!).</b>
              <p>What are the implications... if there was a way to "stake" stablecoins??</p>
              <br></br>
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                Introducing... Proof-of-Deposit
              </h3>
              <div style={{ position: 'relative', width: '100%', height: '350px' }}>
                <Image layout='fill' objectFit='contain' src={`/images/pod.png`}/>
              </div>
            </PanelDescription>
          </div>
        </div>

        <button
          className="ml-auto primary-button"
        >
          <a href="http://files.cambridgecryptographic.com/whitepapers/risk_free_v0.4.pdf">
            Read Our Whitepaper
          </a>
        </button>
      </PanelWithButton>

      <PanelWithButton>
        <div className="justify-between space-x-3">
          <div>
            <PanelHeader>Amplifying MarketCap of Celo and Stablecoins</PanelHeader>
            <PanelDescription>
              <b>A positive feedback loop of demand:</b>
              <ul className="list-inside list-disc mb-1">
                <li>
                  Paying CELO on cUSD deposits creates demand for cUSD <i>(low risk APY)</i>
                </li>
                <li>
                  Demand for cUSD generates demand for CELO <i>(as part of stablecoin mechanism)</i>
                </li>
                <li>
                  Demand for CELO increases APY on cUSD deposits <i>(looping back to the start!)</i>
                </li>
              </ul>
              <div style={{ position: 'relative', width: '100%', height: '350px' }}>
                <Image layout='fill' objectFit='contain' src={`/images/amplified.png`}/>
              </div>
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                How Much Amplification?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                We extended the MarketCap Model from <a href="https://celo.org/papers/stability" className="text-blue-500">
                  Celo's stability analysis
                </a> to include <b>"savings"</b>: a new source of demand for CELO that stems from depositing stablecoins to earn passive APY.
              </p>
              <iframe width="100%" height="350" scrolling="no" src="//plotly.com/~ying_chan/1.embed"></iframe>
            </PanelDescription>
          </div>
        </div>

        <button
          className="ml-auto primary-button"
        >
          <a href="http://files.cambridgecryptographic.com/whitepapers/marketcap_model_v0.1.pdf">
            Read Our Analysis
          </a>
        </button>
      </PanelWithButton>

      <PanelWithButton>
        <div className="justify-between space-x-3">
          <div>
            <PanelHeader>A Market Determined Risk-Free Rate</PanelHeader>
            <PanelDescription>
              <b>Up until now, it has not been possible for a market to provide a risk-free rate.</b> 
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                After-all if a borrower cannot take risk in order to generate profit with money we loan to them, why would they offer any interest in return?
              </p>
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                For the first time in history, Proof-of-Deposit not only replicates a risk-free rate in a decentralised setting,{' '}
                but has the potential to support a Central Bank's counter-cyclical monetary policy.
              </p>

              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                A Decentralised CBDC - Monetary Policy With Configurable Discretion
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                Ideally, a nation state would prefer to issue and borrow in its own currency, since this is less brittle state of affairs,{' '}
                providing greater flexibility, for example, to stimulate their economy during a downturn. However, when a typically smaller nation state{' '}
                takes this course of action (as opposed to dollarisation), the international sovereign bond market demands unfeasibly high rates to{' '}
                compensate for the perceived lack of credible monetary policy (e.g. risk of hyper-inflation).
              </p>
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                A CBDC deployed on a decentralised blockchain is a means by which such nation states can credibly commit to monetary policy with configurable discretion{' '}
                in a publicly verifiable manner:
              </p>
              <ul className="list-inside list-disc mb-1">
                <li>
                  <b>Example</b> (Expansion of monetary base). A Central Bank can limit their rate of issuance via a smart contract that enforces a cap on the quantity of{' '}
                  (currency) tokens that can be minted per year. Alternatively, the Central Bank can voluntarily allow the market to control the supply via a stablecoin mechanism. 
                </li>
                <li>
                  <b>Example</b> (Counter-cyclical risk-free rate). Cannot simply hardcode a rule to pick the appropiate rate for a system as chaotic as the economy.{' '}
                  Proof-of-Deposit can be implemented to create a prediction market on whether debt in an economy is growing at a sustainable rate, incentivising nodes{' '}
                  to offer a high risk-free rate when they deem the economy to be "overheating".   
                </li>
              </ul>
            </PanelDescription>
          </div>
        </div>

        <button
          className="ml-auto primary-button"
        >
          <a href="http://files.cambridgecryptographic.com/whitepapers/configurable_discretion_v0.1.pdf">
            Read Our Summary
          </a>
        </button>
      </PanelWithButton>
    </>
  );
}
