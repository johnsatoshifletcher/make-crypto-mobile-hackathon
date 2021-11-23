import ElectionABI from './abis/Election.json';
import { Address } from '@celo/connect'
import { BigNumber } from 'bignumber.js';

export function trimLeading0x(input) { return (input.startsWith('0x') ? input.slice(2) : input); };
export function normalizeAddress(a) { return trimLeading0x(a).toLowerCase(); };
export function eqAddress(a, b) { return normalizeAddress(a) === normalizeAddress(b); };
export const electionAddress = ElectionABI.networks["44787"].address;

export class Election {
  contract;
  kit;
  tokenAddress;
  account;

  constructor(kit, tokenAddress: Address, account: Address) {
    this.kit = kit;
    this.tokenAddress = tokenAddress;
    this.account = account;
    this.contract = new kit.web3.eth.Contract(
      ElectionABI.abi as any,
      electionAddress
    );
  }

  public async _findLesserAndGreaterAfterVote(groupAddress: Address, value: BigNumber) {
    let currentVotes = await this.getTotalVotesForEligibleValidatorGroups();
    let selectedGroup = currentVotes.find(function (votes) { return eqAddress(votes.address, groupAddress); });

    let voteTotal = selectedGroup ? selectedGroup.votes.plus(value) : value;
    let greaterKey = "0x0000000000000000000000000000000000000000";
    let lesserKey = "0x0000000000000000000000000000000000000000";
    // This leverages the fact that the currentVotes are already sorted from
    // greatest to lowest value
    for (let _i = 0, currentVotes_1 = currentVotes; _i < currentVotes_1.length; _i++) {
        let vote = currentVotes_1[_i];
        if (!eqAddress(vote.address, groupAddress)) {
            if (vote.votes.isLessThanOrEqualTo(voteTotal)) {
                lesserKey = vote.address;
                break;
            }
            greaterKey = vote.address;
        }
    }
    return { lesser: lesserKey, greater: greaterKey };
  }

  public async getTotalVotesForEligibleValidatorGroups(){
    let currentVotes = await this.contract.methods.getTotalVotesForEligibleValidatorGroups(this.tokenAddress).call();
    return currentVotes[0].map((g, i) => {
      return {
        address: g,
        name: `Group ${g.slice(-1).toUpperCase()}`,
        votes: new BigNumber(currentVotes[1][i])
      }
    })
  }

  public async getGroupsVotedForByAccount(){
    return await this.contract.methods.getGroupsVotedForByAccount(this.tokenAddress, this.account).call();
  }
  
  public async activate(){
    let groups = await this.getGroupsVotedForByAccount();
    let isActivatable = await Promise.all(
      groups.map(function (g) { 
        return this.contract.methods.hasActivatablePendingVotes(this.tokenAddress, this.account, g).call(); 
      }, this)
    );
    let groupsActivatable = groups.filter(function (_, i) { return isActivatable[i]; });
    return await Promise.all(
      groupsActivatable.map(function (g) { 
        const txObject = this.contract.methods.activate(this.tokenAddress, g);
        return this.kit.sendTransactionObject(txObject, { from: this.account });
      }, this)
    );
  }

  public async vote(groupAddress: Address, value: BigNumber){
    const _a = await this._findLesserAndGreaterAfterVote(groupAddress, value), lesser = _a.lesser, greater = _a.greater;
    const txObject = await this.contract.methods.vote(this.tokenAddress, groupAddress, value, lesser, greater);
    return await this.kit.sendTransactionObject(txObject, { from: this.account });
  }

  public async getVotesForGroupByAccount(groupAddress: Address){
    let pending = await this.contract.methods.getPendingVotesForGroupByAccount(
      this.tokenAddress, groupAddress, this.account
    ).call();
    let active = await this.contract.methods.getActiveVotesForGroupByAccount(
      this.tokenAddress, groupAddress, this.account
    ).call();
    return {
        group: groupAddress,
        pending: new BigNumber(pending),
        active: new BigNumber(active),
    }
  }

  public async revokePending(groupAddress: Address, value: BigNumber){
    let groups = await this.getGroupsVotedForByAccount()
    let index = groups.indexOf(groupAddress);
    let _a = await this._findLesserAndGreaterAfterVote(groupAddress, value.times(-1)), lesser = _a.lesser, greater = _a.greater;
    let txObject = await this.contract.methods.revokePending(this.tokenAddress, groupAddress, value.toFixed(), lesser, greater, index);
    return await this.kit.sendTransactionObject(txObject, { from: this.account });
  }

  public async revokeActive(groupAddress: Address, value: BigNumber){
    let groups = await this.getGroupsVotedForByAccount();
    let index = groups.indexOf(groupAddress);
    let _a = await this._findLesserAndGreaterAfterVote(groupAddress, value.times(-1)), lesser = _a.lesser, greater = _a.greater;
    let txObject = await this.contract.methods.revokeActive(this.tokenAddress, groupAddress, value.toFixed(), lesser, greater, index);
    return await this.kit.sendTransactionObject(txObject, { from: this.account });
  }

  public async revoke(groupAddress: Address){
    let vote = await this.getVotesForGroupByAccount(groupAddress);
    if (vote.pending.gt(0)){
      await this.revokePending(groupAddress, vote.pending);
    }
    if (vote.active.gt(0)){
      await this.revokeActive(groupAddress, vote.active);
    }
  }

  public async hasActivatablePendingVotes(){
    let groups = await this.getGroupsVotedForByAccount();
    let isActivatable = await Promise.all(
      groups.map(function (g) { 
        return this.contract.methods.hasActivatablePendingVotes(this.tokenAddress, this.account, g).call(); 
      }, this)
    );
    return isActivatable.some(function (a) { return a; });
  }

  public async getTotalVotes(){
    return await this.contract.methods.getTotalVotes(this.tokenAddress).call(); 
  }

  public async distributeEpochRewards(amount: BigNumber) {
    let txObject = await this.contract.methods.distributeEpochRewards(amount);
    return await this.kit.sendTransactionObject(txObject, { from: this.account });
  }

  public async getEpochTokenRewards(amount: BigNumber){
      return new BigNumber(await this.contract.methods.getEpochTokenRewards(this.tokenAddress, amount).call());
  }

  public async getGroupEpochTokenRewards(amount: BigNumber){
      let groups = await this.contract.methods.getEligibleValidatorGroups().call();
      let rewards = await Promise.all(
        groups.map(function (g) { 
          this.contract.methods.getGroupEpochTokenRewards(this.tokenAddress, g, amount).call(); 
        }, this)
      );
      return groups.map(function(g, i) {
        return {
            group: g,
            reward: new BigNumber(rewards[i])
        }
      });
  }

  public async getSwapAddress(){
      return await this.contract.methods.getSwapAddress().call();
  }
}