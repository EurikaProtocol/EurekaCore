// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title EurikaTinanLink — viešas metaduomenų ir nuorodų registras
contract EurikaTinanLink {
    // --- Static Identifiers ---
    string public constant PROJECT_ALIAS = "Eurika_Tinan_IPFS";
    string public constant STATUS = "Active / Decentralized Distribution";
    string public constant OWNER = "Gvidas TinanGroup";

    // --- Core links ---
    address public immutable contractCreator;    //0x5D0435779b10234fD4941cc15fae8C7C86117E91
    address public immutable eurikaProtocol;     // 0x4042973c0863CCA0D73F028cA98465F44F0e6F97

    // --- Configurable fields ---
    string private _unlockCode;
    string private _backupKey;
    string private _neoChainAddress;
    string private _stellarRef;
    string private _ipfsManifest;

    // --- Events ---
    event ManifestUpdated(string indexed oldCid, string indexed newCid, address indexed by);
    event LinksUpdated(string oldNeo, string newNeo, string oldStellar, string newStellar, address by);

    // --- Constructor (BE ARGUMENTŲ ChainGPT UI'E!) ---
    constructor() {
        contractCreator  = msg.sender;
        eurikaProtocol   = 0x4042973c0863CCA0D73F028cA98465F44F0e6F97; // EURIKA
        _unlockCode      = "/-95C_1008";
        _backupKey       = "KNS766";
        _neoChainAddress = "NLwZ4cP6ND5ZD9kZBy81bQSnKowKHcugCz";
        _stellarRef      = "EURIKA*stellar.org";
        _ipfsManifest    = "ipfs://bafybeidylgq47v262g7eol4nmklqbygfpjmj4llzj2s5nxa3ajrrlpnfaa";
    }

    // --- Modifier ---
    modifier onlyCreator() { require(msg.sender == contractCreator, "Not creator"); _; }

    // --- Getters ---
    function unlockCode()       external view returns (string memory) { return _unlockCode; }
    function backupKey()        external view returns (string memory) { return _backupKey; }
    function neoChainAddress()  external view returns (string memory) { return _neoChainAddress; }
    function stellarRef()       external view returns (string memory) { return _stellarRef; }
    function ipfsManifest()     external view returns (string memory) { return _ipfsManifest; }
    function getProtocolAddress() external view returns (address) { return eurikaProtocol; }
    function getOwnerInfo()     external pure returns (string memory) { return OWNER; }

    // --- Management ---
    function updateManifest(string calldata newCid) external onlyCreator {
        require(bytes(newCid).length > 0, "Empty CID");
        string memory old = _ipfsManifest;
        _ipfsManifest = newCid;
        emit ManifestUpdated(old, newCid, msg.sender);
    }

    function updateLinks(string calldata newNeo, string calldata newStellar) external onlyCreator {
        require(bytes(newNeo).length > 0, "Empty Neo");
        require(bytes(newStellar).length > 0, "Empty Stellar");
        string memory oldNeo = _neoChainAddress;
        string memory oldStellar = _stellarRef;
        _neoChainAddress = newNeo;
        _stellarRef = newStellar;
        emit LinksUpdated(oldNeo, newNeo, oldStellar, newStellar, msg.sender);
    }
}