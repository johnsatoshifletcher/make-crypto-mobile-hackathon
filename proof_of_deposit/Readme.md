# ⚡ Cambridge Cryptographic's Hackathon Submission ⚡

**Hackathon Track:** DeFi Track

**Project Name:** Proof-of-Deposit

**Team:** Cambridge Cryptographic

**Location:** United Kingdom (Cambridge)

**Live WebApp (with smart contracts on Testnet):** http://hackathon.cambridgecryptographic.com/

**Video Demonstration:** https://youtu.be/iUs65qZy7eg

**Team Members:**
- Ying Chan, lead developer
- John Fletcher, mathematician / economist
- Marcin Wojcik, developer

# What is Proof-of-Deposit?
Our project, using proprietary blockchain-agnostic technology developed at [Cambridge Cryptographic](https://www.cambridgecryptographic.com/), has a simple but profound aim:

> Leveraging block rewards to create a **"risk-free" interest rate** on stablecoins (e.g. cUSD and cEUR)

<img src="assets/pod.png" alt="positive feedback loop" width="800"/>

It achieves this by allowing the "staking" of, not one, but multiple tokens. One of those tokens must be CELO whose value is strongly coupled to the network (to serve as strong Sybil-defence), but the other tokens can be stablecoins. When block rewards are distributed, it creates in-effect a **"risk-free" interest rate** on stablecoins. 

We call this scheme **Proof-of-Deposit** rather than **Proof-of-Stake** as the value of "deposited" stablecoins are not "at stake" (i.e. validators may not be risking loss of purchasing power from their stablecoins if they behave incorrectly)

## Benefits of Proof-of-Deposit

**Proof-of-Deposit** brings significant benefits that complement Celo's philosophy of providing accessible, mobile-first payments denominated in a token that maintains stable purchasing power:

1. **Tapping into the biggest and most important userbase: those that cannot or do not want take risk with their money such as regulated custodians/banks and non-speculative everyday people.**

    These users, by increasing the liquidity of the stablecoins, helps stablise the peg as the liquidity serves as a buffer against sell-offs by the speculative crowd. The reason that these users will hold cUSD, cEUR, etc is due to the APY offered by **Proof-of-Deposit** (users will deposit if they deem APY to be attractive, and withdraw if they deem it too low).  

2. **Not like other DeFi: amplifying demand for CELO and stablecoins**

   Unlike lending protocols, **Proof-of-Deposit** gives a **"risk-free" rate** where there is no risk of losing your principal. Unlike swap protocols, **Proof-of-Deposit** pays rewards from newly minted CELO (as opposed to a separate token) and from a transaction fees paid by the entire on-chain economy.

   As users who deposit stablecoins earn a passive income paid in CELO, this creates a positive feedback loop: 
   
   i.  CELO price increase -> APY on stablecoin increases

   ii. Demand for stablecoin increases (to deposit for the APY) -> CELO price increases (due to CELO being used as collateral for stablecoin mechanism)  

    <img src="assets/amplified.png" alt="positive feedback loop" width="500"/><br></br>

3. **A novel tool for Central Banks: monetary policy with configurable discretion**

    Central Banks of smaller nations that issue their own sovereign currency are forced by the international sovereign bond market to offer unfeasibly high interest rates to compensate for the perceived risk of runaway inflation (lack of credible monetary policy). 
    
    The most important parameter that contributes to the credibility of monetary policy is how a Central Bank adjusts its risk-free rate. For the first time in history, **Proof-of-Deposit** not only allows a risk-free rate to be market-determined, but has the potential to credibly support a Central Bank's counter-cyclical monetary policy. 

    Ontop of mobile-first payments, this can further make Celo more attractive for Central Banks to adopt as a platform for their CBDCs.


# Overview of Implemented Functionality
## Smart Contracts ([located here](./codebase/contracts))

For this hackathon, we sought to showcase how **Proof-of-Deposit** could be integrated with Celo. To achieve this, we isolated and made modifications to the following [Celo Governance Smart Contracts](https://github.com/celo-org/celo-monorepo/tree/master/packages/protocol/contracts/governance):

1. `LockedGold.sol` (our abstract version is called `LockedToken.sol`)

    i. Modified `lock` and `withdraw` to be compatible with any `ERC20` token (e.g. cUSD, and cEUR)

    ii. Modified the `constructor` to `LockedToken` to be instantiated with a particular `ERC20` token and other initial parameters

    iii. Removed unnecessary dependencies for our proof of concept

2. `Election.sol`

    i. Modified the `constructor` to allow `Election.sol` to be instantiated with multiple `LockedTokens` (e.g. our proof-of-concept uses `LockedCGLD`, `LockedCUSD` and `LockedCEUR`) along with other initial parameters.

    ii. Extended most class variables to be mappings where the key is a `LockedToken` address (such as `LockedCGLD`, `LockedCUSD`, etc)

    iii. Modified almost all functions to include a `address token` parameter, where a specific `LockedToken` address needs to be provided. (e.g. `function vote(address token, address group, uint256 value, ...)` needs to define which `LockedToken` is being used to vote)

    iv. Implemented functions to introduce `"normalised votes"` (e.g. `getGroupTotalVotesNormalised(address token, address group)`), where a normalised vote is the fraction of votes from a particular `LockedToken` for a validator.

    v. Implemented functions to introduce `"influence"` (e.g. `getGroupInfluenceFromTotalVotes(address group)`), where influence is calculated as the `min` over all normalised votes from different `LockedTokens` for a validator.

    vi. Modified `distributeEpochRewards` so that we can showcase how epoch rewards are distributed amongst multiple `LockTokens`.

    vii. Removed unnecessary dependencies for our proof of concept

## WebApp ([located here](./codebase/webapp))

We used [plock.fi](https://github.com/AlexBHarley/plock.fi) as a "SDK" to showcase a possible UI to interact with **Proof-of-Deposit**:

1. **Proof-of-Deposit** overview page that shows all of a user's Lockable tokens, and their respective stats (e.g. average APY):

<img src="assets/overview_page.png" alt="positive feedback loop" width="800"/><br></br>

2. Lockable token management page that allows a user to Lock/Unlock/Withdraw their tokens, Vote with Locked Tokens, as well as see validator group stats (e.g. APY):

<img src="assets/locked_token_page.png" alt="positive feedback loop" width="800"/><br></br>


## Analysis ([located here](./codebase/marketcap_model))

We formally analysed the increased demand for CELO and stablecoins that **Proof-of-Deposit** 

You can view a forecast of the marketcap calculated by our model on [our live WebApp](http://hackathon.cambridgecryptographic.com/).

# Next Steps

For this hackathon we have implemented a proof of concept version to showcase our tech, and have provided preliminary analysis. Next steps are divided between mainnet deployment and CBDC routes:

## Mainnet Deployment

Towards the goal of getting this live:

1. Stringent analysis on the economic and security implications of our tech (e.g. contracting https://chaoslabs.xyz/)

2. Thorough investigation of breaking changes in the wider ecosystem that can come from modifying `Election.sol` and `LockedGold.sol` (e.g. other smart contracts, wallets, `celo-tools`, etc). 

3. Collaborate with cLabs and Mysten Labs to test/architect/develop our tech with a clear phase-in plan. (Unclear if modification/integration of existing governance smart contracts is best way forward)

4. Seek to modularise the "risk-free" rate tech such that it can be used for simulations (e.g. economic analysis) as well as potentially packaging it into a marketable product.

## CBDC

1. Continue our collaboration with economists at IMF, ESM and BoE Advisory Group to produce papers on how blockchains allow for monetary policy with configurable discretion.

2. Collaborate with CBDC team at cLabs

3. Lots of presentations and talks... (its the long game with Central Banks)

# URLs
1. [Live WebApp](http://hackathon.cambridgecryptographic.com/)
2. [Video Demonstration](https://youtu.be/iUs65qZy7eg)
3. [Our Whitepaper - A Market Determined Risk Free Rate](http://files.cambridgecryptographic.com/whitepapers/risk_free_v0.4.pdf)
4. [Our Analysis - A MarketCap Model for Proof-of-Deposit](http://files.cambridgecryptographic.com/whitepapers/marketcap_model_v0.1.pdf)
5. [Our Summary on CBDCs - Monetary Policy with Configurable Discretion](http://files.cambridgecryptographic.com/whitepapers/configurable_discretion_v0.1.pdf)

# Intellectual Property

The modifications to [`Election.sol`](./codebase/contracts/Election.sol) and [`LockedToken.sol`](./codebase/contracts/LockedToken.sol) are the object of the following patent applications: EP20275088.1, GB2016187.3, GB2016186.5.
