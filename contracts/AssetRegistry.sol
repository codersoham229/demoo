// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AssetRegistry — minimal ERC721 digital-asset registry for SIH-26125 prototype
/// @notice Token = registered digital asset (certificate/doc). Metadata lives off-chain; only URI hash anchored.
contract AssetRegistry is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId = 1;

    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => bool) public locked;

    event AssetRegistered(uint256 indexed tokenId, address indexed owner, string tokenURI);
    event AssetTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
    event AssetLocked(uint256 indexed tokenId);
    event AssetUnlocked(uint256 indexed tokenId);

    constructor(address admin) ERC721("SIH Prototype Asset", "SIHPA") {
        require(admin != address(0), "admin required");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    function registerAsset(address to, string calldata tokenURI_) external onlyRole(MINTER_ROLE) returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = tokenURI_;
        emit AssetRegistered(tokenId, to, tokenURI_);
        return tokenId;
    }

    function transferAsset(address to, uint256 tokenId) external {
        require(!locked[tokenId], "asset locked");
        address from = ownerOf(tokenId);
        require(msg.sender == from || isApprovedForAll(from, msg.sender) || getApproved(tokenId) == msg.sender, "not authorized");
        _transfer(from, to, tokenId);
        emit AssetTransferred(tokenId, from, to);
    }

    function lockAsset(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        locked[tokenId] = true;
        emit AssetLocked(tokenId);
    }

    function unlockAsset(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        locked[tokenId] = false;
        emit AssetUnlocked(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
