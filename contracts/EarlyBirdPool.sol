// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./CerealToken.sol";

contract EarlyBirdPool is Ownable {
  using SafeMath for uint256;
  // Amount of cereals rewarded per 1 BCH per hour
  // We use a fixed number of 600 blocks to determine 1 hour, not block.timestamp
  uint16 cerealsPerHour = 100;

  struct Stake {
    uint256 amount;
    uint256 fromBlock;
  }

  uint256 public endBlock;

  mapping (address => Stake) public stakers;

  CerealToken cereal;
  address cerealDev;

  constructor(CerealToken _cereal, uint256 _blocksToLive) public {
    cereal = _cereal;
    endBlock = _blocksToLive.add(block.number);
    cerealDev = msg.sender;
  }

  function getBalance(address staker) view public returns(uint256) {
    return stakers[staker].amount;
  }

  receive() external payable {
    _deposit();
  }

  fallback() external payable {
    _deposit();
  }

  function deposit() external payable {
    _deposit();
  }

  function _deposit() private {
    require(msg.value > 0, "EarlyBirdPool: No BCH deposited!");

    _addStaker(msg.value, msg.sender);
  }

  function _addStaker(uint256 _amount, address _staker) private {
    Stake storage staker = stakers[_staker];
    if (staker.amount > 0) {
      // calculate user's rewards, mint them and reset the fromBlock
      uint256 pendingReward = staker.amount.div(720).mul(cerealsPerHour).div(1e12);
      cereal.mint(_staker, pendingReward.sub(pendingReward.div(10)));
      cereal.mint(cerealDev, pendingReward.div(10));
      staker.amount += _amount;
      staker.fromBlock = block.number;
    } else {
      staker.amount = _amount;
      staker.fromBlock = block.number;
    }
  }

  function _safeSend(address _to, uint256 _amount) private {
    (bool sent, bytes memory data) = _to.call{value: _amount}("");
    require(sent, "Failed to send BCH");
  }

  // to be shown to the user in the front-end 
  function pendingCereal() external view returns(uint256){
    Stake memory staker = stakers[msg.sender];
    uint256 blockDiff = block.number - staker.fromBlock;
    uint256 pending = staker.amount.mul(blockDiff).mul(cerealsPerHour).div(600).div(1e18);
    return pending.sub(pending.div(10));
  }

  function exit() public {
    Stake storage staker = stakers[msg.sender];
    require(staker.amount > 0, "No BCH deposited!");
    require(staker.fromBlock < block.number, "Wait until next block!");

    uint256 stakerAmount = staker.amount;
    // calculate pending
    uint256 blockDiff = block.number - staker.fromBlock;
    uint256 pending = staker.amount.mul(blockDiff).mul(cerealsPerHour).div(600).div(1e18);
    // Safeguard for re-entrancy attack
    staker.amount = 0;
    staker.fromBlock = 0;
    _safeSend(msg.sender, stakerAmount);

    // Mint rewards
    cereal.mint(msg.sender, pending.sub(pending.div(10)));
    cereal.mint(cerealDev, pending.div(10));
  }
}