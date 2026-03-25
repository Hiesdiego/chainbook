// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ActivityRegistry
/// @notice Records on-chain activities from tracked wallets.
///         The Reactivity listener subscribes to ActivityRecorded events.
contract ActivityRegistry {
    // ─── Events ───────────────────────────────────────────────────────────────

    event ActivityRecorded(
        address indexed wallet,
        bytes32 indexed activityType,
        address indexed contractAddress,
        uint256 value,
        bytes32 metadataHash,
        uint256 timestamp
    );

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    mapping(address => bool) public oracles;

    // ─── Activity type constants ──────────────────────────────────────────────

    bytes32 public constant SWAP = keccak256("SWAP");
    bytes32 public constant TRANSFER = keccak256("TRANSFER");
    bytes32 public constant MINT = keccak256("MINT");
    bytes32 public constant NFT_TRADE = keccak256("NFT_TRADE");
    bytes32 public constant DAO_VOTE = keccak256("DAO_VOTE");
    bytes32 public constant LIQUIDITY_ADD = keccak256("LIQUIDITY_ADD");
    bytes32 public constant LIQUIDITY_REMOVE = keccak256("LIQUIDITY_REMOVE");
    bytes32 public constant CONTRACT_DEPLOY = keccak256("CONTRACT_DEPLOY");

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ActivityRegistry: not owner");
        _;
    }

    modifier onlyOracle() {
        require(oracles[msg.sender] || msg.sender == owner, "ActivityRegistry: not oracle");
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

    // ─── Core function ────────────────────────────────────────────────────────

    /// @notice Record an on-chain activity. Called by the Reactivity listener oracle.
    function recordActivity(
        address wallet,
        bytes32 activityType,
        address contractAddress,
        uint256 value,
        bytes32 metadataHash
    ) external onlyOracle {
        emit ActivityRecorded(
            wallet,
            activityType,
            contractAddress,
            value,
            metadataHash,
            block.timestamp
        );
    }

    /// @notice Batch record multiple activities in one tx to save gas
    function recordActivityBatch(
        address[] calldata wallets,
        bytes32[] calldata activityTypes,
        address[] calldata contractAddresses,
        uint256[] calldata values,
        bytes32[] calldata metadataHashes
    ) external onlyOracle {
        require(
            wallets.length == activityTypes.length &&
            wallets.length == contractAddresses.length &&
            wallets.length == values.length &&
            wallets.length == metadataHashes.length,
            "ActivityRegistry: array length mismatch"
        );
        for (uint256 i = 0; i < wallets.length; i++) {
            emit ActivityRecorded(
                wallets[i],
                activityTypes[i],
                contractAddresses[i],
                values[i],
                metadataHashes[i],
                block.timestamp
            );
        }
    }
}
