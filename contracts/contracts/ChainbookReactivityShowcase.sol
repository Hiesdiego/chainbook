// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";

/// @title ChainbookReactivityShowcase
/// @notice Minimal on-chain callback target for Somnia Reactivity showcase subscriptions.
/// @dev Inherits SomniaEventHandler so callback shape matches Reactivity contract tooling.
contract ChainbookReactivityShowcase is SomniaEventHandler {
    event ReactivityProof(
        address indexed emitter,
        bytes32 indexed observedTopic,
        bytes32 indexed observedEventHash,
        uint256 blockNumber
    );

    /// @notice Reactivity callback implementation.
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata eventData
    ) internal override {
        bytes32 observedTopic = eventTopics.length > 0 ? eventTopics[0] : bytes32(0);
        bytes32 observedEventHash = keccak256(
            abi.encode(emitter, eventTopics, eventData, block.number)
        );

        emit ReactivityProof(
            emitter,
            observedTopic,
            observedEventHash,
            block.number
        );
    }
}
