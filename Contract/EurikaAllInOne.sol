// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/*
EURIKA ALL-IN-ONE (single .sol file)
====================================
This file bundles the minimal contracts to wire your ecosystem in one deployable unit:

Contracts included:
- Ownable (minimal)
- ERC20 (minimal, 18 decimals)
- EurikaHub          : cross-chain registry (symbol -> token address per chainId)
- wFLOCKS            : wrapped FLOCKS (mint/burn controlled by owner-approved minters)
- TinanCoin          : simple ERC20 with owner mint/burn (initial 100,000,000 supply to owner)
- EurikaSignals      : on-chain "signal inbox" (bots push events; admin manages bot list)

Notes:
- Keep ownership under a Gnosis Safe, and optionally a Timelock for governance actions.
- Add Uniswap V2 liquidity using official router only: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
- If you already have TINAN or wFLOCKS deployed, you can skip deploying those from this file.

Suggested deployment order:
1) Deploy EurikaHub -> transferOwnership to your Gnosis Safe.
2) Deploy wFLOCKS   -> setMinter(<BRIDGE_MULTISIG>, true), transferOwnership to Safe.
3) Deploy TinanCoin -> initial supply goes to deployer; transfer to Safe; transferOwnership to Safe.
4) (Optional) Deploy EurikaSignals -> grantBot(<BOT_WALLET>, true); owner = Safe.
5) Register tokens in Hub: setToken(chainId,"EURIKA", <addr>, "main ERC20"), etc.

ChainGPT all-in-one command (example you can paste and adapt):
---------------------------------------------------------------
EURIKA_ALL_IN_ONE_V1
Context:
  SAFE: <GNOSIS_SAFE_ADDRESS>
  CHAIN_ID: 1
  TOKEN_EURIKA: <EURIKA_MAINNET_ADDRESS>
  TOKEN_TINAN: <TINAN_MAINNET_ADDRESS or "" if to deploy>
  TOKEN_wFLOCKS: <wFLOCKS_MAINNET_ADDRESS or "" if to deploy>
  ROUTER_V2: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
Plan:
  1) If TOKEN_TINAN empty -> deploy TinanCoin; verify (0.8.21, MIT, optimizer 200).
  2) If TOKEN_wFLOCKS empty -> deploy wFLOCKS; owner=SAFE; setMinter(<BRIDGE_MULTISIG>, true); verify.
  3) Deploy EurikaHub; transferOwnership to SAFE.
  4) Hub.setToken(CHAIN_ID,"EURIKA", TOKEN_EURIKA, "main ERC20");
     Hub.setToken(CHAIN_ID,"TINAN",  TOKEN_TINAN,  "main ERC20");
     Hub.setToken(CHAIN_ID,"wFLOCKS",TOKEN_wFLOCKS,"wrapped Flocks on ETH");
  5) Use Uniswap V2 router (above) to add liquidity for EURIKA/TINAN and EURIKA/wFLOCKS.
  6) Emit governance manifest signature "Tinan Group".
Constraints:
  - Only the official Uniswap V2 router address for liquidity.
  - No unlimited approvals to unknown addresses.
  - Use official RPC (Infura/Alchemy/QuickNode), not dApp-proposed custom RPC.
*/

// -----------------------------------------------------------------------------
// Minimal Ownable
// -----------------------------------------------------------------------------
contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        _transferOwnership(msg.sender);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// -----------------------------------------------------------------------------
// Minimal ERC20 (18 decimals)
// -----------------------------------------------------------------------------
contract ERC20 {
    string public name;
    string public symbol;
    uint8  public immutable decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function transfer(address to, uint256 value) public virtual returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public virtual returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "ERC20: insufficient allowance");
        unchecked { allowance[from][msg.sender] = allowed - value; }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0) && to != address(0), "ERC20: zero address");
        uint256 bal = balanceOf[from];
        require(bal >= value, "ERC20: balance");
        unchecked {
            balanceOf[from] = bal - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        require(to != address(0), "ERC20: mint to zero");
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        require(from != address(0), "ERC20: burn from zero");
        uint256 bal = balanceOf[from];
        require(bal >= value, "ERC20: burn exceeds balance");
        unchecked {
            balanceOf[from] = bal - value;
            totalSupply -= value;
        }
        emit Transfer(from, address(0), value);
    }
}

// -----------------------------------------------------------------------------
// EurikaHub: cross-chain registry (symbol -> token per chainId)
// -----------------------------------------------------------------------------
contract EurikaHub is Ownable {
    // chainId => (keccak256(symbol) => token address)
    mapping(uint256 => mapping(bytes32 => address)) public registry;

    event TokenRegistered(uint256 chainId, string symbol, address token, string note);

    function setToken(uint256 chainId, string calldata symbol, address token, string calldata note) external onlyOwner {
        require(token != address(0), "token=0");
        bytes32 key = keccak256(abi.encodePacked(symbol));
        registry[chainId][key] = token;
        emit TokenRegistered(chainId, symbol, token, note);
    }

    function getToken(uint256 chainId, string calldata symbol) external view returns (address) {
        return registry[chainId][keccak256(abi.encodePacked(symbol))];
    }
}

// -----------------------------------------------------------------------------
// wFLOCKS: wrapped FLOCKS (1:1), controlled minters (bridge or custodian multisig)
// -----------------------------------------------------------------------------
contract wFLOCKS is ERC20, Ownable {
    mapping(address => bool) public isMinter;

    event MinterSet(address indexed who, bool enabled);

    constructor() ERC20("Wrapped FLOCKS", "wFLOCKS") {}

    function setMinter(address who, bool enabled) external onlyOwner {
        isMinter[who] = enabled;
        emit MinterSet(who, enabled);
    }

    function mint(address to, uint256 amount) external {
        require(isMinter[msg.sender], "wFLOCKS: not minter");
        _mint(to, amount);
    }

    // burnFrom used by bridge/minter to redeem underlying
    function burnFrom(address from, uint256 amount) external {
        require(isMinter[msg.sender], "wFLOCKS: not minter");
        _burn(from, amount);
    }
}

// -----------------------------------------------------------------------------
// TinanCoin: simple ERC20 with owner mint/burn
// -----------------------------------------------------------------------------
contract TinanCoin is ERC20, Ownable {
    constructor() ERC20("Tinan Coin", "TINAN") {
        // Initial supply to deployer (recommended to transfer to Safe after)
        _mint(msg.sender, 100_000_000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}

// -----------------------------------------------------------------------------
// EurikaSignals: on-chain "signal inbox" for bots (anomaly detection, LP alerts, etc.)
// Admin manages bot list; bots emit SignalPushed events for off-chain/Timelock reactions.
// -----------------------------------------------------------------------------
contract EurikaSignals is Ownable {
    mapping(address => bool) public isBot;

    event BotSet(address indexed bot, bool enabled);
    event SignalPushed(
        address indexed sender,
        bytes32 indexed kind,
        int256 value,
        string metadata,
        uint256 timestamp
    );

    function grantBot(address bot) external onlyOwner {
        isBot[bot] = true;
        emit BotSet(bot, true);
    }

    function revokeBot(address bot) external onlyOwner {
        isBot[bot] = false;
        emit BotSet(bot, false);
    }

    function pushSignal(bytes32 kind, int256 value, string calldata metadata) external {
        require(isBot[msg.sender], "Signals: not bot");
        emit SignalPushed(msg.sender, kind, value, metadata, block.timestamp);
    }
}
