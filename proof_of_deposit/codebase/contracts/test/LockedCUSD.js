const Web3 = require("web3")
const ContractKit = require('@celo/contractkit')
const CUSD = require('./build/contracts/CUSD.json')
const CGLD = require('./build/contracts/CGLD.json')
const LockedCUSD = require('./build/contracts/LockedCUSD.json')
const LockedCGLD = require('./build/contracts/LockedCGLD.json')

const { 
    getAccount
} = require('./getAccount')

const web3 = new Web3('https://alfajores-forno.celo-testnet.org')
const kit = ContractKit.newKitFromWeb3(web3)



function createContract(contract, networkId){
    return new web3.eth.Contract(contract.abi, contract.networks[networkId].address);
}


async function sendTx(account, txObject){
    let tx = await kit.sendTransactionObject(txObject, { from: account.address });
    return tx.waitReceipt()
}

async function test(){
    let account = await getAccount()
    let networkId = await web3.eth.net.getId();

    let CUSD_inst = createContract(CUSD, networkId);
    let CGLD_inst = createContract(CGLD, networkId);
    let LockedCUSD_inst = createContract(LockedCUSD, networkId);
    let LockedCGLD_inst = createContract(LockedCGLD, networkId);

    // GET BALANCES
    let cGLDBalance = await CGLD_inst.methods.balanceOf(account.address).call()
    let cUSDBalance = await CUSD_inst.methods.balanceOf(account.address).call()

    console.log(`Your account address: ${account.address}`)
    console.log(`Your account CELO balance: ${cGLDBalance.toString()}`)
    console.log(`Your account cUSD balance: ${cUSDBalance.toString()}`)

    // signing stuff
    kit.connection.addAccount(account.privateKey);

    // Approve sending some money to Locked Contract
    console.log('Bumping up the allowance!');
    txObject = await CUSD_inst.methods.approve(LockedCUSD_inst._address, 10000);
    receipt = await sendTx(account, txObject);

    approvedAmount = await CUSD_inst.methods.allowance(account.address, LockedCUSD_inst._address).call()
    console.log(`LockedCUSD is allowed to transfeer: ${approvedAmount.toString()}`)


    // send the money!
    console.log('Locking the money!');
    txObject = await LockedCUSD_inst.methods.lock(1000);
    receipt = await sendTx(account, txObject);
    
    lockedcUSDBalance = await LockedCUSD_inst.methods.getAccountTotalLockedToken(account.address).call();
    console.log(`You have locked: ${lockedcUSDBalance.toString()}`)
    

    // try withdraw, should fail!
    console.log('Try withdraw, should fail!');
    try {
        txObject = await LockedCUSD_inst.methods.withdraw(0);
        receipt = await sendTx(account, txObject);
    }
    catch(err) {
        console.log(`Failed as expected: ${err.message}`)
    }    

    // unlock first
    console.log('Unlocking!');
    txObject = await LockedCUSD_inst.methods.unlock(100);
    receipt = await sendTx(account, txObject);

    // withdraw
    console.log('Try withdraw, should work!');
    txObject = await LockedCUSD_inst.methods.withdraw(0);
    receipt = await sendTx(account, txObject);

    // print stuff
    lockedcUSDBalance = await LockedCUSD_inst.methods.getAccountTotalLockedToken(account.address).call();
    cUSDBalance = await CUSD_inst.methods.balanceOf(account.address).call()
    console.log(`You have locked: ${lockedcUSDBalance.toString()}`)
    console.log(`Your account cUSD balance: ${cUSDBalance.toString()}`)

    // console.log(CUSD._address);
    // console.log(LockedCUSD._address);
}

test()