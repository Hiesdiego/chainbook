// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";

/**
 * @title WhaleWatcher
 * @notice Reactive on-chain contract that monitors ERC20 Transfer events from
 *         configured token contracts and emits WhaleDetected whenever a single
 *         transfer meets or exceeds the configured threshold.
 *
 * Reusability
 * -----------
 * Deploy with your own threshold and token list.  The owner can add/remove
 * watched tokens and update the threshold at any time after deployment.
 *
 * On-chain subscription wiring (done once via deploy script)
 * ----------------------------------------------------------
 * The Somnia subscription tells validators: "when a Transfer event fires from
 * any watched token, call WhaleWatcher._onEvent()".  The handler checks the
 * amount and emits WhaleDetected if the threshold is met.
 *
 * Deployment
 * ----------
 * constructor(uint256 threshold, address[] memory tokens)
 *   threshold : minimum raw token amount (wei) that qualifies as a whale move
 *               e.g. 100_000 * 1e18 for 100k WSTT
 *   tokens    : initial list of ERC20 contracts to watch (e.g. WSTT addresses)
 */
contract WhaleWatcher is SomniaEventHandler {

    // ─── Events ──────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a whale-sized transfer is detected.
     * @param from   Source wallet address
     * @param to     Destination wallet address
     * @param amount Raw token amount transferred (in wei)
     * @param token  ERC20 contract address that emitted the original Transfer
     */
    event WhaleDetected(
        address indexed from,
        address indexed to,
        uint256          amount,
        address indexed  token
    );

    // ─── Storage ─────────────────────────────────────────────────────────────

    address public owner;
    uint256 public threshold;

    /// @notice Returns true if the given token address is actively watched.
    mapping(address => bool) public watchedTokens;

    // ERC20 Transfer(address indexed from, address indexed to, uint256 value)
    bytes32 private constant TRANSFER_TOPIC =
        0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "WhaleWatcher: not owner");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param _threshold  Minimum raw amount (wei) for a transfer to be flagged.
     * @param _tokens     Initial set of ERC20 addresses to watch.
     */
    constructor(uint256 _threshold, address[] memory _tokens) {
        require(_threshold > 0, "WhaleWatcher: threshold must be > 0");
        owner     = msg.sender;
        threshold = _threshold;
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(_tokens[i] != address(0), "WhaleWatcher: zero address");
            watchedTokens[_tokens[i]] = true;
        }
    }

    // ─── Owner controls ──────────────────────────────────────────────────────

    /// @notice Update the whale detection threshold.
    function setThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold > 0, "WhaleWatcher: threshold must be > 0");
        threshold = _threshold;
    }

    /// @notice Add a new ERC20 token to the watch list.
    function addToken(address token) external onlyOwner {
        require(token != address(0), "WhaleWatcher: zero address");
        watchedTokens[token] = true;
    }

    /// @notice Remove an ERC20 token from the watch list.
    function removeToken(address token) external onlyOwner {
        watchedTokens[token] = false;
    }

    /// @notice Transfer contract ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "WhaleWatcher: zero address");
        owner = newOwner;
    }

    // ─── Reactive handler ────────────────────────────────────────────────────

    /**
     * @dev Called by Somnia validators whenever a matching event fires.
     *      The Somnia subscription is configured to forward ERC20 Transfer
     *      events; this handler verifies the emitter is a watched token and
     *      the amount meets the threshold before emitting WhaleDetected.
     *
     * @param emitter      Address of the contract that emitted the event
     * @param eventTopics  topics[] from the original log (topic0 = sig, 1 = from, 2 = to)
     * @param data         ABI-encoded non-indexed params (uint256 value)
     */
    function _onEvent(
        address        emitter,
        bytes32[] calldata eventTopics,
        bytes     calldata data
    ) internal override {
        // Guard: must be a Transfer event
        if (eventTopics.length < 3) return;
        if (eventTopics[0] != TRANSFER_TOPIC) return;

        // Guard: emitter must be a watched token
        if (!watchedTokens[emitter]) return;

        // Decode the transfer amount (only non-indexed field)
        uint256 amount = abi.decode(data, (uint256));

        // Guard: amount must meet the threshold
        if (amount < threshold) return;

        // Decode indexed from/to addresses from topics
        address from = address(uint160(uint256(eventTopics[1])));
        address to   = address(uint160(uint256(eventTopics[2])));

        emit WhaleDetected(from, to, amount, emitter);
    }
}
