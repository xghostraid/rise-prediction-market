// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title OrderBookMarket
/// @notice Minimal on-chain CLOB-style binary market (ETH or ERC-20 collateral).
/// @dev Price is integer cents 1..99. Size is in "shares" (uint256). Each matched share locks `shareUnit`
///      of collateral split between counterparties:
///        - buyer deposit per share:  (shareUnit * price) / 100
///        - seller deposit per share: shareUnit - buyerDeposit
///      Settlement pays `shareUnit` per winning share.
contract OrderBookMarket {
    enum Outcome {
        Pending,
        Yes,
        No
    }

    enum Side {
        BuyYes,
        SellYes,
        BuyNo,
        SellNo
    }

    struct Order {
        address maker;
        Side side;
        uint8 price; // cents (1..99)
        uint256 sizeRemaining; // shares
        uint256 prev;
        uint256 next;
    }

    /// @dev address(0) means native ETH; non-zero is ERC-20 collateral.
    address public immutable collateral;
    /// @dev 1 for ETH markets; 10**decimals for ERC-20 markets.
    uint256 public immutable shareUnit;
    address public immutable oracle;
    uint64 public immutable tradingEndsAt;
    uint64 public immutable claimDelayAfterResolve;
    string public question;

    Outcome public outcome;
    uint64 public claimsOpenAt;

    uint256 public nextOrderId = 1;

    // orderId => Order
    mapping(uint256 => Order) public orders;

    // Price level linked lists per side.
    // side => price => head/tail orderId
    mapping(uint8 => mapping(uint8 => uint256)) public head;
    mapping(uint8 => mapping(uint8 => uint256)) public tail;

    // Internal share balances.
    mapping(address => uint256) public yesShares;
    mapping(address => uint256) public noShares;
    mapping(address => bool) public claimed;

    error TradingClosed();
    error InvalidPrice();
    error SizeZero();
    error NotMaker();
    error NotOracle();
    error AlreadyResolved();
    error TooEarlyToResolve();
    error ClaimsNotOpen();
    error NothingToClaim();
    error AlreadyClaimed();
    error TransferFailed();
    error BadEthAmount();
    error EthNotAccepted();

    event OrderPlaced(uint256 indexed id, address indexed maker, Side side, uint8 price, uint256 size);
    event OrderCancelled(uint256 indexed id, address indexed maker, uint256 sizeRemaining);
    event Trade(
        uint256 indexed makerOrderId,
        address indexed maker,
        address indexed taker,
        Side makerSide,
        uint8 price,
        uint256 size
    );
    event Resolved(Outcome outcome, uint64 claimsOpenAt);
    event Claimed(address indexed user, uint256 payout);

    constructor(
        address collateral_,
        uint8 collateralDecimals_,
        address oracle_,
        uint64 tradingEndsAt_,
        uint64 claimDelayAfterResolve_,
        string memory question_
    ) {
        collateral = collateral_;
        if (collateral_ == address(0)) {
            // ETH: 100 wei per share so integer cents map cleanly.
            shareUnit = 100;
        } else {
            require(collateralDecimals_ <= 18, "bad decimals");
            shareUnit = 10 ** collateralDecimals_;
        }
        oracle = oracle_;
        tradingEndsAt = tradingEndsAt_;
        claimDelayAfterResolve = claimDelayAfterResolve_;
        question = question_;
    }

    function placeLimit(Side side, uint8 price, uint256 size) external payable returns (uint256 id) {
        if (block.timestamp >= tradingEndsAt) revert TradingClosed();
        if (price <= 0 || price >= 100) revert InvalidPrice();
        if (size == 0) revert SizeZero();

        uint256 req = _requiredDeposit(side, price, size);
        _pull(req);

        id = nextOrderId++;
        orders[id] = Order({
            maker: msg.sender,
            side: side,
            price: price,
            sizeRemaining: size,
            prev: 0,
            next: 0
        });

        _append(uint8(side), price, id);
        emit OrderPlaced(id, msg.sender, side, price, size);
    }

    function cancel(uint256 id) external {
        Order storage o = orders[id];
        if (o.maker == address(0)) revert NotMaker();
        if (o.maker != msg.sender) revert NotMaker();
        uint256 rem = o.sizeRemaining;
        if (rem == 0) {
            _remove(uint8(o.side), o.price, id);
            delete orders[id];
            emit OrderCancelled(id, msg.sender, 0);
            return;
        }
        _remove(uint8(o.side), o.price, id);

        // Refund remaining maker deposit.
        uint256 refund = _requiredDeposit(o.side, o.price, rem);
        delete orders[id];

        _push(payable(msg.sender), refund);
        emit OrderCancelled(id, msg.sender, rem);
    }

    /// @notice Take liquidity against a specific order id (simple matching primitive).
    /// @dev The taker must pay the counterparty deposit side for `size`.
    function take(uint256 makerOrderId, uint256 size) external payable {
        if (block.timestamp >= tradingEndsAt) revert TradingClosed();
        Order storage o = orders[makerOrderId];
        if (o.maker == address(0)) revert NotMaker();
        if (size == 0) revert SizeZero();
        if (size > o.sizeRemaining) size = o.sizeRemaining;

        // Cache before potential delete.
        address maker = o.maker;
        Side makerSide = o.side;
        uint8 price = o.price;

        uint256 req = _requiredDeposit(_opposite(makerSide), price, size);
        _pull(req);

        // Update maker order remaining; remove if filled.
        o.sizeRemaining -= size;
        if (o.sizeRemaining == 0) {
            _remove(uint8(makerSide), price, makerOrderId);
            delete orders[makerOrderId];
        }

        // Mint share balances for the trade.
        _mintSharesFromTrade(makerSide, maker, msg.sender, price, size);
        emit Trade(makerOrderId, maker, msg.sender, makerSide, price, size);
    }

    function resolve(bool yesWins) external {
        if (msg.sender != oracle) revert NotOracle();
        if (outcome != Outcome.Pending) revert AlreadyResolved();
        if (block.timestamp < tradingEndsAt) revert TooEarlyToResolve();

        outcome = yesWins ? Outcome.Yes : Outcome.No;
        uint64 openAt;
        unchecked {
            openAt = uint64(block.timestamp) + claimDelayAfterResolve;
        }
        claimsOpenAt = openAt;
        emit Resolved(outcome, openAt);
    }

    function claim() external returns (uint256 payout) {
        if (outcome == Outcome.Pending) revert ClaimsNotOpen();
        if (block.timestamp < claimsOpenAt) revert ClaimsNotOpen();
        if (claimed[msg.sender]) revert AlreadyClaimed();

        uint256 win = outcome == Outcome.Yes ? yesShares[msg.sender] : noShares[msg.sender];
        if (win == 0) revert NothingToClaim();

        claimed[msg.sender] = true;
        payout = win * shareUnit;
        _push(payable(msg.sender), payout);
        emit Claimed(msg.sender, payout);
    }

    function _requiredDeposit(Side side, uint8 price, uint256 size) internal view returns (uint256) {
        uint256 buyPerShare = (shareUnit * uint256(price)) / 100;
        uint256 sellPerShare = shareUnit - buyPerShare;
        if (side == Side.BuyYes) return buyPerShare * size;
        if (side == Side.SellYes) return sellPerShare * size;
        if (side == Side.BuyNo) return buyPerShare * size;
        return sellPerShare * size;
    }

    function _pull(uint256 amount) internal {
        if (amount == 0) {
            if (collateral != address(0) && msg.value != 0) revert EthNotAccepted();
            return;
        }
        if (collateral == address(0)) {
            if (msg.value != amount) revert BadEthAmount();
            return;
        }
        if (msg.value != 0) revert EthNotAccepted();
        bool ok = IERC20(collateral).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();
    }

    function _push(address payable to, uint256 amount) internal {
        if (amount == 0) return;
        if (collateral == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
            return;
        }
        bool ok2 = IERC20(collateral).transfer(to, amount);
        if (!ok2) revert TransferFailed();
    }

    function _opposite(Side side) internal pure returns (Side) {
        if (side == Side.BuyYes) return Side.SellYes;
        if (side == Side.SellYes) return Side.BuyYes;
        if (side == Side.BuyNo) return Side.SellNo;
        return Side.BuyNo;
    }

    function _mintSharesFromTrade(
        Side makerSide,
        address maker,
        address taker,
        uint8 /*price*/,
        uint256 size
    ) internal {
        if (makerSide == Side.BuyYes) {
            // maker buys YES, taker sells YES (gets NO)
            yesShares[maker] += size;
            noShares[taker] += size;
            return;
        }
        if (makerSide == Side.SellYes) {
            // maker sells YES (gets NO), taker buys YES
            noShares[maker] += size;
            yesShares[taker] += size;
            return;
        }
        if (makerSide == Side.BuyNo) {
            noShares[maker] += size;
            yesShares[taker] += size;
            return;
        }
        // SellNo
        yesShares[maker] += size;
        noShares[taker] += size;
    }

    function _append(uint8 side, uint8 price, uint256 id) internal {
        uint256 t = tail[side][price];
        if (t == 0) {
            head[side][price] = id;
            tail[side][price] = id;
            return;
        }
        orders[id].prev = t;
        orders[t].next = id;
        tail[side][price] = id;
    }

    function _remove(uint8 side, uint8 price, uint256 id) internal {
        uint256 p = orders[id].prev;
        uint256 n = orders[id].next;
        if (p != 0) orders[p].next = n;
        if (n != 0) orders[n].prev = p;
        if (head[side][price] == id) head[side][price] = n;
        if (tail[side][price] == id) tail[side][price] = p;
    }
}

