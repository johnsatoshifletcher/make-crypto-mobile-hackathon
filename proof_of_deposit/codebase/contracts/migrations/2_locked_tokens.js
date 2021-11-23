const Web3 = require('web3');

const LockedCGLD = artifacts.require("LockedCGLD");
const LockedCUSD = artifacts.require("LockedCUSD");
const LockedCEUR = artifacts.require("LockedCEUR");
const AddressSortedLinkedList = artifacts.require("AddressSortedLinkedList");
const Election = artifacts.require("Election");
const CGLDAddress = require('../abis/CGLD.json').networks["44787"].address;
const CUSDAddress = require('../abis/CUSD.json').networks["44787"].address;
const CEURAddress = require('../abis/CEUR.json').networks["44787"].address;

module.exports = async function (deployer) {
  deployer.then(async () => {
    await deployer.deploy(LockedCGLD, CGLDAddress, 0);
    const locked_cgld = await LockedCGLD.deployed();
    await deployer.deploy(LockedCUSD, CUSDAddress, 0);
    const locked_cusd = await LockedCUSD.deployed();
    await deployer.deploy(LockedCEUR, CEURAddress, 0);
    const locked_ceur = await LockedCEUR.deployed();

    await deployer.deploy(AddressSortedLinkedList);
    await deployer.link(AddressSortedLinkedList, Election);

    const toWei = Web3.utils.toWei;
    await deployer.deploy(
      Election, 
      [locked_cgld.address, locked_cusd.address, LockedCEUR.address], // token addresses
      [
        "0x000000000000000000000000000000000000000A",
        "0x000000000000000000000000000000000000000B",
        "0x000000000000000000000000000000000000000C",
        "0x000000000000000000000000000000000000000D"
      ], // validator group addresses
      [
        [toWei("1"), toWei("2"), toWei("3"), toWei("4")],
        [toWei("1"), toWei("2"), toWei("3"), toWei("4")],
        [toWei("1"), toWei("2"), toWei("3"), toWei("4")],
      ], // validator default votes
      [
        ["0", "1", "2", "3"],
        ["0", "1", "2", "3"],
        ["0", "1", "2", "3"],
      ], // ordering
      3 // max votes
    );
    const election = await Election.deployed();
    await locked_cgld.setElection(election.address);
    await locked_cusd.setElection(election.address);
    await locked_ceur.setElection(election.address);
  })
};
