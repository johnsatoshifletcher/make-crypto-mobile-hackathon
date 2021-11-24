pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./utils/AddressSortedLinkedList.sol";
import "./utils/FixidityLib.sol";
import "./interfaces/ILockedToken.sol";
import "./interfaces/IElection.sol";
import "./interfaces/IUniswapV2Router01.sol";

contract Election is IElection, ReentrancyGuard
{
  using AddressSortedLinkedList for SortedLinkedList.List;
  using FixidityLib for FixidityLib.Fraction;
  using SafeMath for uint256;

  // 1e20 ensures that units can be represented as precisely as possible to avoid rounding errors
  // when translating to votes, without risking integer overflow.
  // A maximum of 1,000,000,000 CELO (1e27) yields a maximum of 1e47 units, whose product is at
  // most 1e74, which is less than 2^256.
  uint256 private constant UNIT_PRECISION_FACTOR = 100000000000000000000;

  struct PendingVote {
    // The value of the vote, in gold.
    uint256 value;
    // The epoch at which the vote was cast.
    uint256 epoch;
  }

  struct GroupPendingVotes {
    // The total number of pending votes that have been cast for this group.
    uint256 total;
    // Pending votes cast per voter.
    mapping(address => PendingVote) byAccount;
  }

  // Pending votes are those for which no following elections have been held.
  // These votes have yet to contribute to the election of validators and thus do not accrue
  // rewards.
  struct PendingVotes {
    // The total number of pending votes cast across all groups.
    uint256 total;
    mapping(address => GroupPendingVotes) forGroup;
  }

  struct GroupActiveVotes {
    // The total number of active votes that have been cast for this group.
    uint256 total;
    // The total number of active votes by a voter is equal to the number of active vote units for
    // that voter times the total number of active votes divided by the total number of active
    // vote units.
    uint256 totalUnits;
    mapping(address => uint256) unitsByAccount;
  }

  // Active votes are those for which at least one following election has been held.
  // These votes have contributed to the election of validators and thus accrue rewards.
  struct ActiveVotes {
    // The total number of active votes cast across all groups.
    uint256 total;
    mapping(address => GroupActiveVotes) forGroup;
  }

  struct TotalVotes {
    // A list of eligible ValidatorGroups sorted by total (pending+active) votes.
    // Note that this list will omit ineligible ValidatorGroups, including those that may have > 0
    // total votes.
    SortedLinkedList.List eligible;
  }

  struct Votes {
    mapping(address => PendingVotes) pending;
    mapping(address => ActiveVotes) active;
    mapping(address => TotalVotes) total;
    // Maps an account to the list of groups it's voting for.
    mapping(address => mapping(address => address[])) groupsVotedFor;
  }

  struct Lockable {
    address[] addresses;
    mapping(address => bool) valid;
    mapping(address => ILockedToken) instance;
    mapping(address => uint256) weight;
    uint256 total_weight;
  }

  uint256 private epochNumber;
  Lockable private lockable; 
  address private swapAddress;
  IUniswapV2Router01 private swap;
  address private cgldAddress;
  IERC20 private cgld;


  Votes private votes;
  // Governs how many validator groups a single account can vote for.
  uint256 public maxNumGroupsVotedFor;

  event ValidatorGroupVoteCast(address indexed token, address indexed account, address indexed group, uint256 value);
  event ValidatorGroupVoteActivated(
    address indexed token,
    address indexed account,
    address indexed group,
    uint256 value,
    uint256 units
  );
  event ValidatorGroupPendingVoteRevoked(
    address indexed token,
    address indexed account,
    address indexed group,
    uint256 value
  );
  event ValidatorGroupActiveVoteRevoked(
    address indexed token,
    address indexed account,
    address indexed group,
    uint256 value,
    uint256 units
  );
  event EpochRewardsDistributedToVoters(address indexed token, address indexed group, uint256 value);

  /**
   * @notice Sets initialized == true on implementation contracts
   */
  constructor(address[] memory tokens, uint256[] memory weights, address[] memory groups, uint256[][] memory _votes, uint256[][] memory order, uint _maxNumGroupsVotedFor, address _swapAddress, address _cgldAddress) 
  {
    require(tokens.length == weights.length, "weights dim should be same as tokens");
    require(tokens.length == _votes.length, "Votes 1st dim should be same as tokens");
    require(tokens.length == order.length, "Order 2nd dim should be same as tokens");
    for (uint256 i = 0; i < tokens.length; i = i.add(1)) {
        address token = tokens[i];
        lockable.valid[token] = true;
        lockable.instance[token] = ILockedToken(token);
        lockable.addresses.push(token);
        lockable.weight[token] = weights[i];
        lockable.total_weight = lockable.total_weight.add(weights[i]);
        
        require(groups.length == _votes[i].length, "Votes 2nd dim should be same as groups");
        require(groups.length == order[i].length, "Order 2nd dim should be same as groups");
        for (uint256 j = 0; j < groups.length; j = j.add(1)) {
            address group = groups[order[i][j]];
            uint256 v = _votes[i][order[i][j]];
            incrementActiveVotes(token, group, address(this), v);
            if (j == 0) {
                votes.total[token].eligible.insert(group, v, address(0), address(0));
            }else{
                votes.total[token].eligible.insert(group, v, groups[order[i][j.sub(1)]], address(0));
            }
        }
    }
    maxNumGroupsVotedFor = _maxNumGroupsVotedFor;
    swapAddress = _swapAddress;
    swap = IUniswapV2Router01(_swapAddress);
    cgldAddress = _cgldAddress;
    cgld = IERC20(_cgldAddress);
  }

  /**
   * @notice Increments the number of total and pending votes for `group`.
   * @param token The address of the locked token contract.
   * @param group The validator group to vote for.
   * @param value The amount of gold to use to vote.
   * @param lesser The group receiving fewer votes than `group`, or 0 if `group` has the
   *   fewest votes of any validator group.
   * @param greater The group receiving more votes than `group`, or 0 if `group` has the
   *   most votes of any validator group.
   * @return True upon success.
   * @dev Fails if `group` is empty or not a validator group.
   */
  function vote(address token, address group, uint256 value, address lesser, address greater)
    external
    nonReentrant
    returns (bool)
  {
    require(lockable.valid[token], "Invalid locked token contract");
    require(votes.total[token].eligible.contains(group), "Group not eligible");
    require(0 < value, "Vote value cannot be zero");
    address account = msg.sender;

    // Add group to the groups voted for by the account.
    bool alreadyVotedForGroup = false;
    address[] storage groups = votes.groupsVotedFor[account][token];
    for (uint256 i = 0; i < groups.length; i = i.add(1)) {
      alreadyVotedForGroup = alreadyVotedForGroup || groups[i] == group;
    }
    if (!alreadyVotedForGroup) {
      require(groups.length < maxNumGroupsVotedFor, "Voted for too many groups");
      groups.push(group);
    }

    incrementPendingVotes(token, group, account, value);
    incrementTotalVotes(token, group, value, lesser, greater);
    lockable.instance[token].decrementNonvotingAccountBalance(account, value);
    emit ValidatorGroupVoteCast(token, account, group, value);
    return true;
  }

  /**
   * @notice Converts `account`'s pending votes for `group` to active votes.
   * @param token The address of the locked token contract.
   * @param group The validator group to vote for.
   * @return True upon success.
   * @dev Pending votes cannot be activated until an election has been held.
   */
  function activate(address token, address group) external nonReentrant returns (bool) {
    require(lockable.valid[token], "Invalid locked token contract");
    address account = msg.sender;
    return _activate(token, group, account);
  }

  /**
   * @notice Converts `account`'s pending votes for `group` to active votes.
   * @param token The address of the locked token contract.
   * @param group The validator group to vote for.
   * @return True upon success.
   * @dev Pending votes cannot be activated until an election has been held.
   */
  function _activate(address token, address group, address account) internal returns (bool) {
    PendingVote storage pendingVote = votes.pending[token].forGroup[group].byAccount[account];
    require(pendingVote.epoch < epochNumber, "Pending vote epoch not passed");
    uint256 value = pendingVote.value;
    require(value > 0, "Vote value cannot be zero");
    decrementPendingVotes(token, group, account, value);
    uint256 units = incrementActiveVotes(token, group, account, value);
    emit ValidatorGroupVoteActivated(token, account, group, value, units);
    return true;
  }

  /**
   * @notice Returns whether or not an account's votes for the specified group can be activated.
   * @param token The address of the locked token contract.
   * @param account The account with pending votes.
   * @param group The validator group that `account` has pending votes for.
   * @return Whether or not `account` has activatable votes for `group`.
   * @dev Pending votes cannot be activated until an election has been held.
   */
  function hasActivatablePendingVotes(address token, address account, address group) external view returns (bool) {
    require(lockable.valid[token], "Invalid locked token contract");
    PendingVote storage pendingVote = votes.pending[token].forGroup[group].byAccount[account];
    return pendingVote.epoch < epochNumber && pendingVote.value > 0;
  }

  /**
   * @notice Revokes `value` pending votes for `group`
   * @param token The address of the locked token contract.
   * @param group The validator group to revoke votes from.
   * @param value The number of votes to revoke.
   * @param lesser The group receiving fewer votes than the group for which the vote was revoked,
   *   or 0 if that group has the fewest votes of any validator group.
   * @param greater The group receiving more votes than the group for which the vote was revoked,
   *   or 0 if that group has the most votes of any validator group.
   * @param index The index of the group in the account's voting list.
   * @return True upon success.
   * @dev Fails if the account has not voted on a validator group.
   */
  function revokePending(
    address token,
    address group,
    uint256 value,
    address lesser,
    address greater,
    uint256 index
  ) external nonReentrant returns (bool) {
    require(lockable.valid[token], "Invalid locked token contract");
    require(group != address(0), "Group address zero");
    address account = msg.sender;
    require(0 < value, "Vote value cannot be zero");
    require(
      value <= getPendingVotesForGroupByAccount(token, group, account),
      "Vote value larger than pending votes"
    );
    decrementPendingVotes(token, group, account, value);
    decrementTotalVotes(token, group, value, lesser, greater);
    lockable.instance[token].incrementNonvotingAccountBalance(account, value);
    if (getTotalVotesForGroupByAccount(token, group, account) == 0) {
      deleteElement(votes.groupsVotedFor[account][token], group, index);
    }
    emit ValidatorGroupPendingVoteRevoked(token, account, group, value);
    return true;
  }

  /**
   * @notice Revokes all active votes for `group`
   * @param token The address of the locked token contract.
   * @param group The validator group to revoke votes from.
   * @param lesser The group receiving fewer votes than the group for which the vote was revoked,
   *   or 0 if that group has the fewest votes of any validator group.
   * @param greater The group receiving more votes than the group for which the vote was revoked,
   *   or 0 if that group has the most votes of any validator group.
   * @param index The index of the group in the account's voting list.
   * @return True upon success.
   * @dev Fails if the account has not voted on a validator group.
   */
  function revokeAllActive(address token, address group, address lesser, address greater, uint256 index)
    external
    nonReentrant
    returns (bool)
  {
    require(lockable.valid[token], "Invalid locked token contract");
    address account = msg.sender;
    uint256 value = getActiveVotesForGroupByAccount(token, group, account);
    return _revokeActive(token, group, value, lesser, greater, index);
  }

  /**
   * @notice Revokes `value` active votes for `group`
   * @param token The address of the locked token contract.
   * @param group The validator group to revoke votes from.
   * @param value The number of votes to revoke.
   * @param lesser The group receiving fewer votes than the group for which the vote was revoked,
   *   or 0 if that group has the fewest votes of any validator group.
   * @param greater The group receiving more votes than the group for which the vote was revoked,
   *   or 0 if that group has the most votes of any validator group.
   * @param index The index of the group in the account's voting list.
   * @return True upon success.
   * @dev Fails if the account has not voted on a validator group.
   */
  function revokeActive(
    address token,
    address group,
    uint256 value,
    address lesser,
    address greater,
    uint256 index
  ) external nonReentrant returns (bool) {
    require(lockable.valid[token], "Invalid locked token contract");
    return _revokeActive(token, group, value, lesser, greater, index);
  }

  function _revokeActive(
    address token,
    address group,
    uint256 value,
    address lesser,
    address greater,
    uint256 index
  ) internal returns (bool) {
    // TODO(asa): Dedup with revokePending.
    require(group != address(0), "Group address zero");
    address account = msg.sender;
    require(0 < value, "Vote value cannot be zero");
    require(
      value <= getActiveVotesForGroupByAccount(token, group, account),
      "Vote value larger than active votes"
    );
    uint256 units = decrementActiveVotes(token, group, account, value);
    decrementTotalVotes(token, group, value, lesser, greater);
    lockable.instance[token].incrementNonvotingAccountBalance(account, value);
    if (getTotalVotesForGroupByAccount(token, group, account) == 0) {
      deleteElement(votes.groupsVotedFor[account][token], group, index);
    }
    emit ValidatorGroupActiveVoteRevoked(token, account, group, value, units);
    return true;
  }

  /**
   * @notice Decrements `value` pending or active votes for `group` from `account`.
   *         First revokes all pending votes and then, if `value` votes haven't
   *         been revoked yet, revokes additional active votes.
   *         Fundamentally calls `revokePending` and `revokeActive` but only resorts groups once.
   * @param token The address of the locked token contract.
   * @param account The account whose votes to `group` should be decremented.
   * @param group The validator group to decrement votes from.
   * @param maxValue The maxinum number of votes to decrement and revoke.
   * @param lesser The group receiving fewer votes than the group for which the vote was revoked,
   *               or 0 if that group has the fewest votes of any validator group.
   * @param greater The group receiving more votes than the group for which the vote was revoked,
   *                or 0 if that group has the most votes of any validator group.
   * @param index The index of the group in the account's voting list.
   * @return uint256 Number of votes successfully decremented and revoked, with a max of `value`.
   */
  function _decrementVotes(
    address token,
    address account,
    address group,
    uint256 maxValue,
    address lesser,
    address greater,
    uint256 index
  ) internal returns (uint256) {
    uint256 remainingValue = maxValue;
    uint256 pendingVotes = getPendingVotesForGroupByAccount(token, group, account);
    if (pendingVotes > 0) {
      uint256 decrementValue = Math.min(remainingValue, pendingVotes);
      decrementPendingVotes(token, group, account, decrementValue);
      emit ValidatorGroupPendingVoteRevoked(token, account, group, decrementValue);
      remainingValue = remainingValue.sub(decrementValue);
    }
    uint256 activeVotes = getActiveVotesForGroupByAccount(token, group, account);
    if (activeVotes > 0 && remainingValue > 0) {
      uint256 decrementValue = Math.min(remainingValue, activeVotes);
      uint256 units = decrementActiveVotes(token, group, account, decrementValue);
      emit ValidatorGroupActiveVoteRevoked(token, account, group, decrementValue, units);
      remainingValue = remainingValue.sub(decrementValue);
    }
    uint256 decrementedValue = maxValue.sub(remainingValue);
    if (decrementedValue > 0) {
      decrementTotalVotes(token, group, decrementedValue, lesser, greater);
      if (getTotalVotesForGroupByAccount(token, group, account) == 0) {
        deleteElement(votes.groupsVotedFor[account][token], group, index);
      }
    }
    return decrementedValue;
  }

  /**
  * @notice Gets address of the Swap smart contract.
  */
  function getSwapAddress() external view returns (address) {
    return swapAddress;
  }

  /**
   * @notice Returns the total number of votes cast by an account.
   * @param token The address of the locked token contract.
   * @param account The address of the account.
   * @return The total number of votes cast by an account.
   */
  function getTotalVotesByAccount(address token, address account) external view returns (uint256) {
    uint256 total = 0;
    address[] memory groups = votes.groupsVotedFor[account][token];
    for (uint256 i = 0; i < groups.length; i = i.add(1)) {
      total = total.add(getTotalVotesForGroupByAccount(token, groups[i], account));
    }
    return total;
  }

  /**
   * @notice Returns the pending votes for `group` made by `account`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @param account The address of the voting account.
   * @return The pending votes for `group` made by `account`.
   */
  function getPendingVotesForGroupByAccount(address token, address group, address account)
    public
    view
    returns (uint256)
  {
    return votes.pending[token].forGroup[group].byAccount[account].value;
  }

  /**
   * @notice Returns the active votes for `group` made by `account`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @param account The address of the voting account.
   * @return The active votes for `group` made by `account`.
   */
  function getActiveVotesForGroupByAccount(address token, address group, address account)
    public
    view
    returns (uint256)
  {
    return unitsToVotes(token, group, votes.active[token].forGroup[group].unitsByAccount[account]);
  }

  /**
   * @notice Returns the total votes for `group` made by `account`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @param account The address of the voting account.
   * @return The total votes for `group` made by `account`.
   */
  function getTotalVotesForGroupByAccount(address token, address group, address account)
    public
    view
    returns (uint256)
  {
    uint256 pending = getPendingVotesForGroupByAccount(token, group, account);
    uint256 active = getActiveVotesForGroupByAccount(token, group, account);
    return pending.add(active);
  }

  /**
   * @notice Returns the active vote units for `group` made by `account`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @param account The address of the voting account.
   * @return The active vote units for `group` made by `account`.
   */
  function getActiveVoteUnitsForGroupByAccount(address token, address group, address account)
    external
    view
    returns (uint256)
  {
    return votes.active[token].forGroup[group].unitsByAccount[account];
  }

  /**
   * @notice Returns the total active vote units made for `group`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @return The total active vote units made for `group`.
   */
  function getActiveVoteUnitsForGroup(address token, address group) external view returns (uint256) {
    return votes.active[token].forGroup[group].totalUnits;
  }

  /**
   * @notice Returns the total votes made for `group`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @return The total votes made for `group`.
   */
  function getTotalVotesForGroup(address token, address group) public view returns (uint256) {
    return votes.pending[token].forGroup[group].total.add(votes.active[token].forGroup[group].total);
  }

  /**
   * @notice Returns the active votes made for `group`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @return The active votes made for `group`.
   */
  function getActiveVotesForGroup(address token, address group) public view returns (uint256) {
    return votes.active[token].forGroup[group].total;
  }

  /**
   * @notice Returns the pending votes made for `group`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @return The pending votes made for `group`.
   */
  function getPendingVotesForGroup(address token, address group) public view returns (uint256) {
    return votes.pending[token].forGroup[group].total;
  }

  /**
   * @notice Returns whether or not a group is eligible to receive votes.
   * @param token The address of the locked token contract.
   * @return Whether or not a group is eligible to receive votes.
   * @dev Eligible groups that have received their maximum number of votes cannot receive more.
   */
  function getGroupEligibility(address token, address group) external view returns (bool) {
    return votes.total[token].eligible.contains(group);
  }


  /**
   * @notice Returns the amount of token rewards that voters are due at the end of an epoch.
   * @param token The address of the locked token contract.
   * @param totalEpochRewards The total amount of CELO going to all voters.
   * @return The amount of token rewards that voters are due at the end of an epoch.
   */
  function getEpochTokenRewards(
    address token,
    uint256 totalEpochRewards
  ) public view returns (uint256) {
    FixidityLib.Fraction memory tokenWeight = FixidityLib.newFixedFraction(
      lockable.weight[token],
      lockable.total_weight
    );
    uint256 amount = FixidityLib
        .newFixed(totalEpochRewards)
        .multiply(tokenWeight)
        .fromFixed();

    address erc20Address = lockable.instance[token].getERC20Address();
    if (erc20Address != cgldAddress){
        address[] memory paths = new address[](2);
        paths[0] = cgldAddress;
        paths[1] = erc20Address;

        return swap.getAmountsOut(amount, paths)[1];
    }else{
        return amount;
    }
  }

  /**
   * @notice Returns the amount of token rewards that voters for `group` are due at the end of an epoch.
   * @param token The address of the locked token contract.
   * @param group The group to calculate epoch rewards for.
   * @param totalEpochRewards The total amount of CELO going to all voters.
   * @return The amount of token rewards that voters for `group` are due at the end of an epoch.
   */
  function getGroupEpochTokenRewards(
    address token,
    address group,
    uint256 totalEpochRewards
  ) external view returns (uint256) {
    FixidityLib.Fraction memory votePortion = FixidityLib.newFixedFraction(
      votes.active[token].forGroup[group].total,
      votes.active[token].total
    );
    FixidityLib.Fraction memory tokenWeight = FixidityLib.newFixedFraction(
      lockable.weight[token],
      lockable.total_weight
    );
    uint256 amount = FixidityLib
        .newFixed(totalEpochRewards)
        .multiply(votePortion)
        .multiply(tokenWeight)
        .fromFixed();

    address erc20Address = lockable.instance[token].getERC20Address();
    if (erc20Address != cgldAddress){
        address[] memory paths = new address[](2);
        paths[0] = cgldAddress;
        paths[1] = erc20Address;

        return swap.getAmountsOut(amount, paths)[0];
    }else{
        return amount;
    }
  }

  /**
   * @notice Distributes epoch rewards to voters and groups in the form of active votes.
    * @param amount The amount of CELO to distribute as epoch rewards.
   */
  function distributeEpochRewards(uint256 amount) external
  {      
    // loop through each token and calculate the proportion to be distributed
    for (uint256 i = 0; i < lockable.addresses.length; i = i.add(1)) {
        address token = lockable.addresses[i];

        FixidityLib.Fraction memory tokenWeight = FixidityLib.newFixedFraction(
            lockable.weight[token],
            lockable.total_weight
        );
        uint256 tokenAmount = FixidityLib
            .newFixed(amount)
            .multiply(tokenWeight)
            .fromFixed();
            
        _distributeEpochTokenRewards(token, tokenAmount);
    }

    epochNumber = epochNumber.add(1);
  }

  /**
   * @notice Swaps epoch token rewards before distributing
   * @param token The address of the locked token contract.
   * @param amount The amount of CELO to distribute to voters for the group.
   */
  function _distributeEpochTokenRewards(address token, uint256 amount) private {
    address erc20Address = lockable.instance[token].getERC20Address();
    IERC20 erc20 = IERC20(erc20Address);
    
    require(amount <= cgld.allowance(msg.sender, address(this)), "insufficient allowance");
    cgld.transferFrom(msg.sender, address(this), amount); // move the amount to the locked smart contract
    if (erc20Address != cgldAddress)
    {
        address[] memory paths = new address[](2);
        paths[0] = cgldAddress;
        paths[1] = erc20Address;

        cgld.approve(swapAddress, amount);
        amount = swap.swapExactTokensForTokens(
            amount,
            1,
            paths,
            address(this),
            block.timestamp.add(10000000)
        )[1];
    }
    erc20.transfer(token, amount); // move the amount to the locked smart contract
    
    // update groups voting power
    address[] memory sortedGroups = votes.total[token].eligible.getKeys();

    address greater = address(0);
    for (uint256 i = 0; i < sortedGroups.length; i = i.add(1)) {
        address group = sortedGroups[i];

        if(i + 1 < sortedGroups.length){
            _distributeEpochTokenRewardsToGroup(token, group, amount, sortedGroups[i.add(1)], greater);
        }else{
            _distributeEpochTokenRewardsToGroup(token, group, amount, address(0), greater);
        }

        greater = group;
    }
  }

  /**
   * @notice Distributes epoch token rewards to voters and groups in the form of active votes.
   * @param token The address of the locked token contract.
   * @param group The validator group whose vote total should be incremented.
   * @param amount The amount of token to distribute to voters for the group.
   * @param lesser The group receiving fewer votes than the group for which the vote was cast,
   *   or 0 if that group has the fewest votes of any validator group.
   * @param greater The group receiving more votes than the group for which the vote was cast,
   *   or 0 if that group has the most votes of any validator group.
   */
  function _distributeEpochTokenRewardsToGroup(address token, address group, uint256 amount, address lesser, address greater) private {
    FixidityLib.Fraction memory votePortion = FixidityLib.newFixedFraction(
        votes.active[token].forGroup[group].total,
        votes.active[token].total
    );
    uint256 reward = FixidityLib
        .newFixed(amount)
        .multiply(votePortion)
        .fromFixed();

    uint256 newVoteTotal = votes.total[token].eligible.getValue(group).add(reward);
    votes.total[token].eligible.update(group, newVoteTotal, lesser, greater);

    votes.active[token].forGroup[group].total = votes.active[token].forGroup[group].total.add(reward);
    votes.active[token].total = votes.active[token].total.add(reward);
    emit EpochRewardsDistributedToVoters(token, group, reward);
  }

  /**
   * @notice Increments the number of total votes for `group` by `value`.
   * @param token The address of the locked token contract.
   * @param group The validator group whose vote total should be incremented.
   * @param value The number of votes to increment.
   * @param lesser The group receiving fewer votes than the group for which the vote was cast,
   *   or 0 if that group has the fewest votes of any validator group.
   * @param greater The group receiving more votes than the group for which the vote was cast,
   *   or 0 if that group has the most votes of any validator group.
   */
  function incrementTotalVotes(address token, address group, uint256 value, address lesser, address greater)
    private
  {
    uint256 newVoteTotal = votes.total[token].eligible.getValue(group).add(value);
    votes.total[token].eligible.update(group, newVoteTotal, lesser, greater);
  }

  /**
   * @notice Decrements the number of total votes for `group` by `value`.
   * @param token The address of the locked token contract.
   * @param group The validator group whose vote total should be decremented.
   * @param value The number of votes to decrement.
   * @param lesser The group receiving fewer votes than the group for which the vote was revoked,
   *   or 0 if that group has the fewest votes of any validator group.
   * @param greater The group receiving more votes than the group for which the vote was revoked,
   *   or 0 if that group has the most votes of any validator group.
   */
  function decrementTotalVotes(address token, address group, uint256 value, address lesser, address greater)
    private
  {
    if (votes.total[token].eligible.contains(group)) {
      uint256 newVoteTotal = votes.total[token].eligible.getValue(group).sub(value);
      votes.total[token].eligible.update(group, newVoteTotal, lesser, greater);
    }
  }

  /**
   * @notice Increments the number of pending votes for `group` made by `account`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @param account The address of the voting account.
   * @param value The number of votes.
   */
  function incrementPendingVotes(address token, address group, address account, uint256 value) private {
    PendingVotes storage pending = votes.pending[token];
    pending.total = pending.total.add(value);

    GroupPendingVotes storage groupPending = pending.forGroup[group];
    groupPending.total = groupPending.total.add(value);

    PendingVote storage pendingVote = groupPending.byAccount[account];
    pendingVote.value = pendingVote.value.add(value);
    pendingVote.epoch = epochNumber;
  }

  /**
   * @notice Decrements the number of pending votes for `group` made by `account`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @param account The address of the voting account.
   * @param value The number of votes.
   */
  function decrementPendingVotes(address token, address group, address account, uint256 value) private {
    PendingVotes storage pending = votes.pending[token];
    pending.total = pending.total.sub(value);

    GroupPendingVotes storage groupPending = pending.forGroup[group];
    groupPending.total = groupPending.total.sub(value);

    PendingVote storage pendingVote = groupPending.byAccount[account];
    pendingVote.value = pendingVote.value.sub(value);
    if (pendingVote.value == 0) {
      pendingVote.epoch = 0;
    }
  }

  /**
   * @notice Increments the number of active votes for `group` made by `account`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @param account The address of the voting account.
   * @param value The number of votes.
   */
  function incrementActiveVotes(address token, address group, address account, uint256 value)
    private
    returns (uint256)
  {
    ActiveVotes storage active = votes.active[token];
    active.total = active.total.add(value);

    uint256 units = votesToUnits(token, group, value);

    GroupActiveVotes storage groupActive = active.forGroup[group];
    groupActive.total = groupActive.total.add(value);

    groupActive.totalUnits = groupActive.totalUnits.add(units);
    groupActive.unitsByAccount[account] = groupActive.unitsByAccount[account].add(units);
    return units;
  }

  /**
   * @notice Decrements the number of active votes for `group` made by `account`.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @param account The address of the voting account.
   * @param value The number of votes.
   */
  function decrementActiveVotes(address token, address group, address account, uint256 value)
    private
    returns (uint256)
  {
    ActiveVotes storage active = votes.active[token];
    active.total = active.total.sub(value);

    // Rounding may cause votesToUnits to return 0 for value != 0, preventing users
    // from revoking the last of their votes. The case where value == votes is special cased
    // to prevent this.
    uint256 units = 0;
    uint256 activeVotes = getActiveVotesForGroupByAccount(token, group, account);
    GroupActiveVotes storage groupActive = active.forGroup[group];
    if (activeVotes == value) {
      units = groupActive.unitsByAccount[account];
    } else {
      units = votesToUnits(token, group, value);
    }

    groupActive.total = groupActive.total.sub(value);
    groupActive.totalUnits = groupActive.totalUnits.sub(units);
    groupActive.unitsByAccount[account] = groupActive.unitsByAccount[account].sub(units);
    return units;
  }

  /**
   * @notice Returns the number of units corresponding to `value` active votes.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @param value The number of active votes.
   * @return The corresponding number of units.
   */
  function votesToUnits(address token, address group, uint256 value) private view returns (uint256) {
    if (votes.active[token].forGroup[group].totalUnits == 0) {
      return value.mul(UNIT_PRECISION_FACTOR);
    } else {
      return
        value.mul(votes.active[token].forGroup[group].totalUnits).div(votes.active[token].forGroup[group].total);
    }
  }

  /**
   * @notice Returns the number of active votes corresponding to `value` units.
   * @param token The address of the locked token contract.
   * @param group The address of the validator group.
   * @param value The number of units.
   * @return The corresponding number of active votes.
   */
  function unitsToVotes(address token, address group, uint256 value) private view returns (uint256) {
    if (votes.active[token].forGroup[group].totalUnits == 0) {
      return 0;
    } else {
      return
        value.mul(votes.active[token].forGroup[group].total).div(votes.active[token].forGroup[group].totalUnits);
    }
  }

  /**
   * @notice Returns the groups that `account` has voted for.
   * @param token The address of the locked token contract.
   * @param account The address of the account casting votes.
   * @return The groups that `account` has voted for.
   */
  function getGroupsVotedForByAccount(address token, address account) external view returns (address[] memory) {
    return votes.groupsVotedFor[account][token];
  }

  /**
   * @notice Deletes an element from a list of addresses.
   * @param list The list of addresses.
   * @param element The address to delete.
   * @param index The index of `element` in the list.
   */
  function deleteElement(address[] storage list, address element, uint256 index) private {
    require(index < list.length && list[index] == element, "Bad index");
    delete list[index];
  }

  /**
   * @notice Returns the total votes received across all groups.
   * @param token The address of the locked token contract.
   * @return The total votes received across all groups.
   */
  function getTotalVotes(address token) public view returns (uint256) {
    return votes.active[token].total.add(votes.pending[token].total);
  }

  /**
   * @notice Returns the active votes received across all groups.
   * @param token The address of the locked token contract.
   * @return The active votes received across all groups.
   */
  function getActiveVotes(address token) public view returns (uint256) {
    return votes.active[token].total;
  }

  /**
   * @notice Returns the list of validator groups eligible to elect validators.
   * @param token The address of the locked token contract.
   * @return The list of validator groups eligible to elect validators.
   */
  function getEligibleValidatorGroups(address token) external view returns (address[] memory) {
    return votes.total[token].eligible.getKeys();
  }

  /**
   * @notice Returns lists of all validator groups and the number of votes they've received.
   * @param token The address of the locked token contract.
   */
  function getTotalVotesForEligibleValidatorGroups(address token)
    external
    view
    returns (address[] memory groups, uint256[] memory values)
  {
    return votes.total[token].eligible.getElements();
  }
}