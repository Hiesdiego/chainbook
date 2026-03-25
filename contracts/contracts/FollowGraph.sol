// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FollowGraph
/// @notice On-chain social graph. Wallets follow other wallets.
contract FollowGraph {
    // ─── Events ───────────────────────────────────────────────────────────────

    event Followed(address indexed follower, address indexed subject);
    event Unfollowed(address indexed follower, address indexed subject);

    // ─── State ────────────────────────────────────────────────────────────────

    // follower => subject => following bool
    mapping(address => mapping(address => bool)) private _following;

    // subject => follower count
    mapping(address => uint256) public followerCount;

    // follower => following count
    mapping(address => uint256) public followingCount;

    // ─── Functions ────────────────────────────────────────────────────────────

    /// @notice Follow a wallet
    function follow(address subject) external {
        require(subject != msg.sender, "FollowGraph: cannot follow yourself");
        require(subject != address(0), "FollowGraph: zero address");
        require(!_following[msg.sender][subject], "FollowGraph: already following");

        _following[msg.sender][subject] = true;
        followerCount[subject]++;
        followingCount[msg.sender]++;

        emit Followed(msg.sender, subject);
    }

    /// @notice Unfollow a wallet
    function unfollow(address subject) external {
        require(_following[msg.sender][subject], "FollowGraph: not following");

        _following[msg.sender][subject] = false;
        followerCount[subject]--;
        followingCount[msg.sender]--;

        emit Unfollowed(msg.sender, subject);
    }

    /// @notice Check if follower is following subject
    function isFollowing(address follower, address subject)
        external
        view
        returns (bool)
    {
        return _following[follower][subject];
    }

    /// @notice Get follower count for a wallet
    function getFollowerCount(address subject) external view returns (uint256) {
        return followerCount[subject];
    }

    /// @notice Get following count for a wallet
    function getFollowingCount(address follower) external view returns (uint256) {
        return followingCount[follower];
    }
}
