const LockedCUSD = artifacts.require("LockedCUSD");
const tokenAddress = require('../abis/CUSD.json').networks["44787"].address;

module.exports = function (deployer) {
  // token address of CUSD ERC20, unlocking period
  deployer.deploy(LockedCUSD, tokenAddress, 0);
};
