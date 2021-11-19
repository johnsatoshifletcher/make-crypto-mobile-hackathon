const LockedCGLD = artifacts.require("LockedCGLD");
const tokenAddress = require('../abis/CGLD.json').networks["44787"].address;

module.exports = function (deployer) {
  // token address of CGLD ERC20, unlocking period
  deployer.deploy(LockedCGLD, tokenAddress, 0);
};