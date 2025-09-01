// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title Olym3Token
 * @dev Olym3Chain Genesis Token Contract
 * 
 * Features:
 * - Standard ERC20 functionality
 * - Burnable tokens
 * - Pausable transfers (for emergency)
 * - Owner controls
 * - Permit functionality for gasless approvals
 * - Genesis distribution support
 */
contract Olym3Token is ERC20, ERC20Burnable, ERC20Pausable, Ownable, ERC20Permit {
    
    // Token metadata
    uint8 private constant _DECIMALS = 18;
    uint256 private constant _MAX_SUPPLY = 100_000_000 * 10**_DECIMALS; // 100M max supply
    
    // Genesis distribution tracking
    mapping(address => bool) private _genesisAccounts;
    uint256 private _genesisDistributed;
    uint256 private _maxGenesisSupply;
    
    // Events
    event GenesisAccountAdded(address indexed account, uint256 amount);
    event GenesisDistributionCompleted(uint256 totalDistributed);
    event EmergencyPause(address indexed by, string reason);
    event EmergencyUnpause(address indexed by);
    
    /**
     * @dev Constructor
     * @param initialSupply Initial token supply for genesis distribution
     * @param tokenName Token name
     * @param tokenSymbol Token symbol
     * @param tokenDecimals Token decimals
     */
    constructor(
        uint256 initialSupply,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) ERC20(tokenName, tokenSymbol) Ownable(msg.sender) ERC20Permit(tokenName) {
        require(initialSupply <= _MAX_SUPPLY, "Initial supply exceeds max supply");
        require(tokenDecimals == _DECIMALS, "Decimals must be 18");
        
        _maxGenesisSupply = initialSupply;
        
        // Mint initial supply to contract owner (for distribution)
        _mint(msg.sender, initialSupply);
        
        emit GenesisDistributionCompleted(initialSupply);
    }
    
    /**
     * @dev Returns the number of decimals used
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
    
    /**
     * @dev Returns the maximum supply
     */
    function maxSupply() public pure returns (uint256) {
        return _MAX_SUPPLY;
    }
    
    /**
     * @dev Returns the maximum genesis supply
     */
    function maxGenesisSupply() public view returns (uint256) {
        return _maxGenesisSupply;
    }
    
    /**
     * @dev Returns the amount of tokens distributed to genesis accounts
     */
    function genesisDistributed() public view returns (uint256) {
        return _genesisDistributed;
    }
    
    /**
     * @dev Check if an address is a genesis account
     */
    function isGenesisAccount(address account) public view returns (bool) {
        return _genesisAccounts[account];
    }
    
    /**
     * @dev Add a genesis account and distribute tokens
     * @param account Address to add as genesis account
     * @param amount Amount of tokens to distribute
     */
    function addGenesisAccount(address account, uint256 amount) external onlyOwner {
        require(account != address(0), "Invalid address");
        require(amount > 0, "Amount must be greater than 0");
        require(!_genesisAccounts[account], "Account already added as genesis");
        require(_genesisDistributed + amount <= _maxGenesisSupply, "Exceeds max genesis supply");
        
        _genesisAccounts[account] = true;
        _genesisDistributed += amount;
        
        // Transfer tokens from owner to genesis account
        _transfer(owner(), account, amount);
        
        emit GenesisAccountAdded(account, amount);
    }
    
    /**
     * @dev Batch add multiple genesis accounts
     * @param accounts Array of addresses to add as genesis accounts
     * @param amounts Array of amounts to distribute to each account
     */
    function batchAddGenesisAccounts(
        address[] calldata accounts,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(accounts.length == amounts.length, "Arrays length mismatch");
        require(accounts.length > 0, "Empty arrays");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(_genesisDistributed + totalAmount <= _maxGenesisSupply, "Exceeds max genesis supply");
        
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "Invalid address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            require(!_genesisAccounts[accounts[i]], "Account already added as genesis");
            
            _genesisAccounts[accounts[i]] = true;
            _genesisDistributed += amounts[i];
            
            // Transfer tokens from owner to genesis account
            _transfer(owner(), accounts[i], amounts[i]);
            
            emit GenesisAccountAdded(accounts[i], amounts[i]);
        }
    }
    
    /**
     * @dev Emergency pause function
     * @param reason Reason for pausing
     */
    function emergencyPause(string calldata reason) external onlyOwner {
        _pause();
        emit EmergencyPause(msg.sender, reason);
    }
    
    /**
     * @dev Emergency unpause function
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
        emit EmergencyUnpause(msg.sender);
    }
    
    /**
     * @dev Mint additional tokens (only owner, up to max supply)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(totalSupply() + amount <= _MAX_SUPPLY, "Exceeds max supply");
        
        _mint(to, amount);
    }
    
    /**
     * @dev Batch transfer function for efficient distribution
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer
     */
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            
            _transfer(msg.sender, recipients[i], amounts[i]);
        }
    }
    
    /**
     * @dev Get genesis distribution statistics
     */
    function getGenesisStats() external view returns (
        uint256 maxSupply_,
        uint256 maxGenesisSupply_,
        uint256 genesisDistributed_,
        uint256 remainingGenesisSupply_,
        uint256 totalSupply_
    ) {
        maxSupply_ = _MAX_SUPPLY;
        maxGenesisSupply_ = _maxGenesisSupply;
        genesisDistributed_ = _genesisDistributed;
        remainingGenesisSupply_ = _maxGenesisSupply - _genesisDistributed;
        totalSupply_ = totalSupply();
    }
    
    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
