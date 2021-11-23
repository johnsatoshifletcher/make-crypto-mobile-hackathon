pragma solidity ^0.8.0;

interface IElection {
  function vote(address, address, uint256, address, address) external returns (bool);
  function activate(address, address) external returns (bool);
  function revokeActive(address, address, uint256, address, address, uint256) external returns (bool);
  function revokeAllActive(address, address, address, address, uint256) external returns (bool);
  function revokePending(address, address, uint256, address, address, uint256) external returns (bool);
  function distributeEpochRewards(uint256) external;

  // view functions
  function getSwapAddress() external view returns (address);
  function getTotalVotes(address) external view returns (uint256);
  function getActiveVotes(address) external view returns (uint256);
  function getTotalVotesByAccount(address, address) external view returns (uint256);
  function getPendingVotesForGroupByAccount(address, address, address) external view returns (uint256);
  function getActiveVotesForGroupByAccount(address, address, address) external view returns (uint256);
  function getTotalVotesForGroupByAccount(address, address, address) external view returns (uint256);
  function getActiveVoteUnitsForGroupByAccount(address, address, address) external view returns (uint256);
  function getTotalVotesForGroup(address, address) external view returns (uint256);
  function getActiveVotesForGroup(address, address) external view returns (uint256);
  function getPendingVotesForGroup(address, address) external view returns (uint256);
  function getGroupEligibility(address, address) external view returns (bool);
  function getEpochTokenRewards(address, uint256) external view returns (uint256);
  function getGroupEpochTokenRewards(address, address, uint256) external view returns (uint256);
  function getGroupsVotedForByAccount(address, address) external view returns (address[] memory);
  function getEligibleValidatorGroups(address) external view returns (address[] memory);
  function getTotalVotesForEligibleValidatorGroups(address)
    external
    view
    returns (address[] memory, uint256[] memory);
  function hasActivatablePendingVotes(address, address, address) external view returns (bool);
}