// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ReputationEngine
/// @notice Calculates and stores wallet reputation scores and tiers.
///         Only oracle addresses (the listener service) can update scores.
contract ReputationEngine {
    // ─── Events ───────────────────────────────────────────────────────────────

    event ScoreUpdated(
        address indexed wallet,
        uint256 newScore,
        bytes32 tier,
        uint256 timestamp
    );

    // ─── Tier constants ───────────────────────────────────────────────────────

    bytes32 public constant WHALE = keccak256("WHALE");   // score >= 1_000_000
    bytes32 public constant SHARK = keccak256("SHARK");   // score >= 100_000
    bytes32 public constant FISH = keccak256("FISH");     // score >= 10_000
    bytes32 public constant CRAB = keccak256("CRAB");     // score >= 1_000
    bytes32 public constant SHRIMP = keccak256("SHRIMP"); // score < 1_000

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    mapping(address => bool) public oracles;

    struct WalletReputation {
        uint256 score;
        bytes32 tier;
        uint256 volumeUsd;    // cumulative USD volume (scaled by 1e2 for cents)
        uint256 activityCount;
        uint256 lastUpdated;
    }

    mapping(address => WalletReputation) public reputations;

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ReputationEngine: not owner");
        _;
    }

    modifier onlyOracle() {
        require(oracles[msg.sender] || msg.sender == owner, "ReputationEngine: not oracle");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        oracles[msg.sender] = true;
    }

    // ─── Oracle management ────────────────────────────────────────────────────

    function addOracle(address oracle) external onlyOwner {
        oracles[oracle] = true;
    }

    function removeOracle(address oracle) external onlyOwner {
        oracles[oracle] = false;
    }

    // ─── Score logic ──────────────────────────────────────────────────────────

    /// @notice Update a wallet's reputation score. Called by listener oracle.
    /// @param wallet The wallet to update
    /// @param volumeDeltaUsd USD volume delta scaled by 1e2 (cents)
    /// @param activityDelta Number of new activities to add
    function updateScore(
        address wallet,
        uint256 volumeDeltaUsd,
        uint256 activityDelta
    ) external onlyOracle {
        WalletReputation storage rep = reputations[wallet];

        rep.volumeUsd += volumeDeltaUsd;
        rep.activityCount += activityDelta;

        // Score formula: volume contributes 70%, activity count 30%
        // Volume component: volumeUsd / 1e4 (normalise cents to dollars then scale)
        // Activity component: activityCount * 10
        uint256 volumeScore = rep.volumeUsd / 1e4;
        uint256 activityScore = rep.activityCount * 10;
        rep.score = volumeScore + activityScore;

        rep.tier = _getTier(rep.score);
        rep.lastUpdated = block.timestamp;

        emit ScoreUpdated(wallet, rep.score, rep.tier, block.timestamp);
    }

    /// @notice Get full reputation data for a wallet
    function getReputation(address wallet)
        external
        view
        returns (
            uint256 score,
            bytes32 tier,
            uint256 volumeUsd,
            uint256 activityCount,
            uint256 lastUpdated
        )
    {
        WalletReputation memory rep = reputations[wallet];
        return (
            rep.score,
            rep.tier == bytes32(0) ? SHRIMP : rep.tier,
            rep.volumeUsd,
            rep.activityCount,
            rep.lastUpdated
        );
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _getTier(uint256 score) internal pure returns (bytes32) {
        if (score >= 1_000_000) return keccak256("WHALE");
        if (score >= 100_000)   return keccak256("SHARK");
        if (score >= 10_000)    return keccak256("FISH");
        if (score >= 1_000)     return keccak256("CRAB");
        return keccak256("SHRIMP");
    }
}
