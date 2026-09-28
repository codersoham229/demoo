// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AccessManager — minimal role-based access control for SIH-26125 prototype
/// @notice Uses OpenZeppelin AccessControl. All grants/revokes emit events for the Audit page.
contract AccessManager is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    event RoleGrantedLogged(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevokedLogged(bytes32 indexed role, address indexed account, address indexed sender);

    constructor(address admin) {
        require(admin != address(0), "admin required");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    function grantIssuer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(ISSUER_ROLE, account);
        emit RoleGrantedLogged(ISSUER_ROLE, account, msg.sender);
    }

    function revokeIssuer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(ISSUER_ROLE, account);
        emit RoleRevokedLogged(ISSUER_ROLE, account, msg.sender);
    }

    function grantVerifier(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(VERIFIER_ROLE, account);
        emit RoleGrantedLogged(VERIFIER_ROLE, account, msg.sender);
    }

    function revokeVerifier(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(VERIFIER_ROLE, account);
        emit RoleRevokedLogged(VERIFIER_ROLE, account, msg.sender);
    }

    function hasIssuerRole(address account) external view returns (bool) {
        return hasRole(ISSUER_ROLE, account);
    }

    function hasVerifierRole(address account) external view returns (bool) {
        return hasRole(VERIFIER_ROLE, account);
    }
}
