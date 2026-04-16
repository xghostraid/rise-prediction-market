// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title BinaryMarket
/// @notice Minimal parimutuel-style YES/NO market.
/// @dev Collateral: `address(0)` = native ETH; otherwise an ERC20 (e.g. USDC on RISE).
///      Oracle resolves after `tradingEndsAt`. After resolution, claims open after `claimDelayAfterResolve`
///      (governance / ops window). Winners split the full pot pro-rata.
contract BinaryMarket {
    /// @dev `address(0)` means native ETH; non-zero is ERC20 (pass USDC contract address on deploy).
    address public immutable collateral;
    address public immutable oracle;
    uint64 public immutable tradingEndsAt;
    /// @dev Seconds after `resolve` before winners may `claim` (use 0 for instant claims in tests).
    uint64 public immutable claimDelayAfterResolve;
    string public question;

    uint256 public totalYes;
    uint256 public totalNo;
    mapping(address => uint256) public yesStake;
    mapping(address => uint256) public noStake;

    enum Outcome {
        Pending,
        Yes,
        No
    }
    Outcome public outcome;
    /// @dev Earliest timestamp when `claim` succeeds; set in `resolve`. 0 while pending.
    uint64 public claimsOpenAt;

    mapping(address => bool) public claimed;

    error TradingClosed();
    error NotOracle();
    error AlreadyResolved();
    error TooEarlyToResolve();
    error InvalidWinningSide();
    error NothingToClaim();
    error AlreadyClaimed();
    error TransferFailed();
    error BadEthAmount();
    error EthNotAccepted();
    error ClaimsNotOpen();
    error ResolutionTimeOverflow();

    event BetYes(address indexed user, uint256 amount);
    event BetNo(address indexed user, uint256 amount);
    event Resolved(Outcome outcome, uint64 claimsOpenAt);
    event Claimed(address indexed user, uint256 payout);

    constructor(
        address collateral_,
        address oracle_,
        uint64 tradingEndsAt_,
        uint64 claimDelayAfterResolve_,
        string memory question_
    ) {
        collateral = collateral_;
        oracle = oracle_;
        tradingEndsAt = tradingEndsAt_;
        claimDelayAfterResolve = claimDelayAfterResolve_;
        question = question_;
    }

    /// @notice For ETH markets (`collateral == address(0)`), send exactly `amount` as `msg.value`.
    function betYes(uint256 amount) external payable {
        if (block.timestamp >= tradingEndsAt) revert TradingClosed();
        if (amount == 0) return;
        _pull(amount);
        yesStake[msg.sender] += amount;
        totalYes += amount;
        emit BetYes(msg.sender, amount);
    }

    /// @notice For ETH markets, send exactly `amount` as `msg.value`.
    function betNo(uint256 amount) external payable {
        if (block.timestamp >= tradingEndsAt) revert TradingClosed();
        if (amount == 0) return;
        _pull(amount);
        noStake[msg.sender] += amount;
        totalNo += amount;
        emit BetNo(msg.sender, amount);
    }

    /// @param yesWins If true, YES side wins the pot; otherwise NO side wins.
    function resolve(bool yesWins) external {
        if (msg.sender != oracle) revert NotOracle();
        if (outcome != Outcome.Pending) revert AlreadyResolved();
        if (block.timestamp < tradingEndsAt) revert TooEarlyToResolve();

        if (yesWins) {
            if (totalYes == 0) revert InvalidWinningSide();
            outcome = Outcome.Yes;
        } else {
            if (totalNo == 0) revert InvalidWinningSide();
            outcome = Outcome.No;
        }

        uint256 open = uint256(block.timestamp) + uint256(claimDelayAfterResolve);
        if (open > type(uint64).max) revert ResolutionTimeOverflow();
        claimsOpenAt = uint64(open);

        emit Resolved(outcome, claimsOpenAt);
    }

    function claim() external returns (uint256 payout) {
        if (outcome == Outcome.Pending) revert NothingToClaim();
        if (block.timestamp < claimsOpenAt) revert ClaimsNotOpen();
        if (claimed[msg.sender]) revert AlreadyClaimed();

        uint256 pot = totalYes + totalNo;

        if (outcome == Outcome.Yes) {
            uint256 stake = yesStake[msg.sender];
            if (stake == 0) revert NothingToClaim();
            payout = (stake * pot) / totalYes;
        } else {
            uint256 stake = noStake[msg.sender];
            if (stake == 0) revert NothingToClaim();
            payout = (stake * pot) / totalNo;
        }

        claimed[msg.sender] = true;
        emit Claimed(msg.sender, payout);
        _push(msg.sender, payout);
    }

    function _pull(uint256 amount) internal {
        if (collateral == address(0)) {
            if (msg.value != amount) revert BadEthAmount();
        } else {
            if (msg.value != 0) revert EthNotAccepted();
            bool ok = IERC20(collateral).transferFrom(msg.sender, address(this), amount);
            if (!ok) revert TransferFailed();
        }
    }

    function _push(address to, uint256 amount) internal {
        if (collateral == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            bool ok = IERC20(collateral).transfer(to, amount);
            if (!ok) revert TransferFailed();
        }
    }

    receive() external payable {
        revert EthNotAccepted();
    }
}
