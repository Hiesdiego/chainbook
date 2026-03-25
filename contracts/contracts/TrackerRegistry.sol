// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TrackerRegistry
/// @notice Stores which wallets/contracts/tokens a user is tracking.
contract TrackerRegistry {
    // ─── Events ───────────────────────────────────────────────────────────────

    event EntityTracked(
        address indexed tracker,
        address indexed entity,
        bytes32 entityType
    );

    event EntityUntracked(
        address indexed tracker,
        address indexed entity
    );

    // ─── Entity type constants ────────────────────────────────────────────────

    bytes32 public constant WALLET = keccak256("WALLET");
    bytes32 public constant CONTRACT = keccak256("CONTRACT");
    bytes32 public constant TOKEN = keccak256("TOKEN");
    bytes32 public constant NFT = keccak256("NFT");

    // ─── State ────────────────────────────────────────────────────────────────

    // tracker => entity => entityType (bytes32(0) means not tracked)
    mapping(address => mapping(address => bytes32)) public trackedEntities;

    // tracker => list of tracked entity addresses
    mapping(address => address[]) private _trackerEntities;

    // tracker => entity => index in _trackerEntities
    mapping(address => mapping(address => uint256)) private _entityIndex;

    // ─── Functions ────────────────────────────────────────────────────────────

    /// @notice Start tracking an entity
    function trackEntity(address entity, bytes32 entityType) external {
        require(entity != address(0), "TrackerRegistry: zero address");
        require(entityType != bytes32(0), "TrackerRegistry: invalid type");
        require(
            trackedEntities[msg.sender][entity] == bytes32(0),
            "TrackerRegistry: already tracked"
        );

        trackedEntities[msg.sender][entity] = entityType;
        _entityIndex[msg.sender][entity] = _trackerEntities[msg.sender].length;
        _trackerEntities[msg.sender].push(entity);

        emit EntityTracked(msg.sender, entity, entityType);
    }

    /// @notice Stop tracking an entity
    function untrackEntity(address entity) external {
        require(
            trackedEntities[msg.sender][entity] != bytes32(0),
            "TrackerRegistry: not tracked"
        );

        // Swap and pop for gas efficient removal
        uint256 index = _entityIndex[msg.sender][entity];
        address[] storage entities = _trackerEntities[msg.sender];
        address last = entities[entities.length - 1];

        entities[index] = last;
        _entityIndex[msg.sender][last] = index;
        entities.pop();

        delete trackedEntities[msg.sender][entity];
        delete _entityIndex[msg.sender][entity];

        emit EntityUntracked(msg.sender, entity);
    }

    /// @notice Get all entities tracked by a wallet
    function getTrackedEntities(address tracker)
        external
        view
        returns (address[] memory)
    {
        return _trackerEntities[tracker];
    }

    /// @notice Check if a wallet is tracking an entity
    function isTracking(address tracker, address entity)
        external
        view
        returns (bool)
    {
        return trackedEntities[tracker][entity] != bytes32(0);
    }

    /// @notice Get the count of entities a tracker is watching
    function getTrackedCount(address tracker) external view returns (uint256) {
        return _trackerEntities[tracker].length;
    }
}
