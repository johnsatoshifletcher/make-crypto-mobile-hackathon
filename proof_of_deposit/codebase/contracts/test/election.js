const Web3 = require("web3")
const ContractKit = require('@celo/contractkit')
const CGLD = require('../abis/CGLD.json')
const CUSD = require('../abis/CUSD.json')
const CEUR = require('../abis/CEUR.json')
const LockedCGLD = require('../build/contracts/LockedCGLD.json')
const LockedCUSD = require('../build/contracts/LockedCUSD.json')
const LockedCEUR = require('../build/contracts/LockedCEUR.json')
const Election = require('../build/contracts/Election.json')
const Router = require('../build/contracts/IUniswapV2Router01.json')

const { 
    getAccount
} = require('../getAccount')

const web3 = new Web3('https://alfajores-forno.celo-testnet.org')
const kit = ContractKit.newKitFromWeb3(web3)



function createContract(contract, networkId){
    return new web3.eth.Contract(contract.abi, contract.networks[networkId].address);
}

async function sendTx(account, txObject){
    let tx = await kit.sendTransactionObject(txObject, { from: account.address, gas: 20000000 });
    return tx.waitReceipt()
}

async function test(){
    let account = await getAccount()
    let networkId = await web3.eth.net.getId();

    let CGLD_inst = createContract(CGLD, networkId);
    let CUSD_inst = createContract(CUSD, networkId);
    let CEUR_inst = createContract(CEUR, networkId);
    let LockedCGLD_inst = createContract(LockedCGLD, networkId);
    let LockedCUSD_inst = createContract(LockedCUSD, networkId);
    let LockedCEUR_inst = createContract(LockedCEUR, networkId);
    let Election_inst = createContract(Election, networkId);
    let Router_inst = createContract(Router, networkId);

    // // GET BALANCES
    // let cGLDBalance = await CGLD_inst.methods.balanceOf(account.address).call()
    // let cUSDBalance = await CUSD_inst.methods.balanceOf(account.address).call()

    // console.log(`Your account address: ${account.address}`)
    // console.log(`Your account CELO balance: ${cGLDBalance.toString()}`)
    // console.log(`Your account cUSD balance: ${cUSDBalance.toString()}`)

    // signing stuff
    kit.connection.addAccount(account.privateKey);

    // const [, result] = await Router_inst.methods
    //     .getAmountsOut(
    //         Web3.utils.toWei("1"), [CGLD.networks[networkId].address, CUSD.networks[networkId].address]
    //     )
    //     .call();
    // console.log(Web3.utils.fromWei(result));
    // console.log("cgld", Web3.utils.fromWei(await Election_inst.methods.getEpochRewards(LockedCGLD_inst._address, Web3.utils.toWei("1"), false).call()));
    // console.log("cusd", Web3.utils.fromWei(await Election_inst.methods.getEpochRewards(LockedCUSD_inst._address, Web3.utils.toWei("1"), false).call()));
    // console.log("ceur", Web3.utils.fromWei(await Election_inst.methods.getEpochRewards(LockedCEUR_inst._address, Web3.utils.toWei("1"), false).call()));
    console.log("increasing allowance");
    await sendTx(account, await CGLD_inst.methods.approve(Election_inst._address, Web3.utils.toWei("1")));
    // console.log("getting groups");
    // let groups = await Election_inst.methods.getEligibleValidatorGroups(LockedCGLD_inst._address).call();
    // console.log(groups);
    // console.log("getGroupsTotalVotesNormalised");
    // console.log(
    //     await Election_inst.methods.getGroupsTotalVotesNormalised(LockedCGLD_inst._address).call()
    // );
    // console.log("getGroupsInfluenceFromTotalVotes");
    // console.log(
    //     await Election_inst.methods.getGroupsInfluenceFromTotalVotes().call()
    // );
    console.log("getGroupsEpochRewardsFromTotalVotes");
    
    const tokens = [
        LockedCGLD_inst._address,
        LockedCUSD_inst._address,
        LockedCEUR_inst._address
    ];
    let results = await Promise.all(tokens.map(
        a => Election_inst.methods.getGroupsEpochRewardsFromTotalVotes(a, Web3.utils.toWei("1"), false).call()
    ))
    const groups = results.map(r => r[0]);
    const groupsEpochRewards = results.map(r => r[2]);
    const epochRewards = results.map(r => r[3]);
    console.log({tokens, groups, groupsEpochRewards, epochRewards});

    console.log("distributing");
    await sendTx(account, await Election_inst.methods.distributeEpochRewards(
        tokens, groups, groupsEpochRewards, epochRewards
    ));

    // console.log(Web3.utils.fromWei(
    //     await Election_inst.methods.getEpochTokenRewards(
    //         LockedCUSD.networks[networkId].address,
    //         Web3.utils.toWei("1")
    //     ).call()
    // ));

    // let cGLDBalance = await CGLD_inst.methods.balanceOf(account.address).call();
    // let cUSDBalance = await CUSD_inst.methods.balanceOf(account.address).call();
    // let cEURBalance = await CEUR_inst.methods.balanceOf(account.address).call();

    // console.log(`Your account address: ${account.address}`)
    // console.log(`Your account CELO balance: ${cGLDBalance.toString()}`)
    // console.log(`Your account cUSD balance: ${cUSDBalance.toString()}`)
    // console.log(`Your account cUSD balance: ${cEURBalance.toString()}`)

    // // Approve sending some money to Locked Contract
    // console.log('Bumping up the allowance!');
    // await sendTx(account, await CGLD_inst.methods.approve(Election_inst._address, 10000));
    // await sendTx(account, await CUSD_inst.methods.approve(Election_inst._address, 10000));
    // await sendTx(account, await CEUR_inst.methods.approve(Election_inst._address, 10000));


    // // distribute
    // console.log('Locking the money!');
    // receipt = await sendTx(account, await Election_inst.methods.distributeEpochRewards(1000));
    // console.log(receipt);
}

test()