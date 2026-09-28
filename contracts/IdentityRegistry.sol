// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IdentityRegistry — minimal DID anchor registry for SIH-26125 prototype
/// @notice Maps a wallet to an off-chain DID + credential hash. No personal data stored on-chain.
contract IdentityRegistry {
    struct Identity {
        string did;
        bytes32 credentialHash;
        bool revoked;
        uint256 updatedAt;
    }

    mapping(address => Identity) private _identities;

    event IdentityAnchored(address indexed user, string did, bytes32 credentialHash);
    event IdentityRevoked(address indexed user, string did);
    event IdentityUpdated(address indexed user, string did, bytes32 credentialHash);

    function anchorIdentity(string calldata did, bytes32 credentialHash) external {
        require(bytes(did).length > 0, "DID required");
        require(bytes(_identities[msg.sender].did).length == 0, "already anchored");
        _identities[msg.sender] = Identity(did, credentialHash, false, block.timestamp);
        emit IdentityAnchored(msg.sender, did, credentialHash);
    }

    function updateIdentity(string calldata did, bytes32 credentialHash) external {
        require(bytes(_identities[msg.sender].did).length != 0, "not anchored");
        require(!_identities[msg.sender].revoked, "revoked");
        _identities[msg.sender].did = did;
        _identities[msg.sender].credentialHash = credentialHash;
        _identities[msg.sender].updatedAt = block.timestamp;
        emit IdentityUpdated(msg.sender, did, credentialHash);
    }

    function revokeIdentity() external {
        require(bytes(_identities[msg.sender].did).length != 0, "not anchored");
        _identities[msg.sender].revoked = true;
        _identities[msg.sender].updatedAt = block.timestamp;
        emit IdentityRevoked(msg.sender, _identities[msg.sender].did);
    }

    function getIdentity(address user) external view returns (Identity memory) {
        return _identities[user];
    }

    function isValid(address user) external view returns (bool) {
        Identity memory id = _identities[user];
        return bytes(id.did).length != 0 && !id.revoked;
    }
}
