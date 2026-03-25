// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PostRegistry
/// @notice Stores social reactions to blockchain-generated posts.
///         Users cannot create posts — only react to them.
///         postId is a keccak256 hash generated off-chain from (txHash + logIndex).
contract PostRegistry {
    // ─── Events ───────────────────────────────────────────────────────────────

    event PostLiked(bytes32 indexed postId, address indexed liker);
    event PostUnliked(bytes32 indexed postId, address indexed liker);

    // ─── State ────────────────────────────────────────────────────────────────

    // postId => liker => hasLiked
    mapping(bytes32 => mapping(address => bool)) private _likes;

    // postId => total like count
    mapping(bytes32 => uint256) public likeCount;

    // ─── Functions ────────────────────────────────────────────────────────────

    /// @notice Like a post
    function likePost(bytes32 postId) external {
        require(!_likes[postId][msg.sender], "PostRegistry: already liked");

        _likes[postId][msg.sender] = true;
        likeCount[postId]++;

        emit PostLiked(postId, msg.sender);
    }

    /// @notice Unlike a post
    function unlikePost(bytes32 postId) external {
        require(_likes[postId][msg.sender], "PostRegistry: not liked");

        _likes[postId][msg.sender] = false;
        likeCount[postId]--;

        emit PostUnliked(postId, msg.sender);
    }

    /// @notice Check if a wallet has liked a post
    function hasLiked(bytes32 postId, address wallet)
        external
        view
        returns (bool)
    {
        return _likes[postId][wallet];
    }

    /// @notice Get like count for a post
    function getLikeCount(bytes32 postId) external view returns (uint256) {
        return likeCount[postId];
    }
}
