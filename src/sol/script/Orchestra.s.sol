// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import {Orchestra} from "../src/Orchestra.sol";
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

contract DeployOrchestra is Script {
    function run() external returns (address orchestraAddr) {
        // Network-specific configuration based on chain ID
        (address wormholeAddress, uint8 finality, bytes32 aztecEmitter) = _getNetworkConfig();

        console.log("=== Deployment Configuration ===");
        console.log("Chain ID:", block.chainid);
        console.log("Wormhole Address:", wormholeAddress);
        console.log("Finality:", finality);
        console.log("=====================================");

        vm.startBroadcast();

        // Deploy Donation contract
        Orchestra orchestra = new Orchestra(wormholeAddress);
        orchestraAddr = address(orchestra);
        console.log("Orchestra deployed to:", orchestraAddr);

        // Register Aztec emitter
        // vault.registerEmitter(56, aztecEmitter); // 56 = Aztec Wormhole Chain ID
        // console.log("Registered Aztec emitter:", vm.toString(aztecEmitter));

        vm.stopBroadcast();

        console.log("Deployment completed successfully!");
    }

    function _getNetworkConfig() internal view returns (address wormholeAddress, uint8 finality, bytes32 aztecEmitter) {
        if (block.chainid == 421614) {
            //Arbitrum Sepolia
            wormholeAddress = address(0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35);
        } else if (block.chainid == 11155111) {
            //ETH Sepolia
            wormholeAddress = address(0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78);
        }
        finality = uint8(2);
        aztecEmitter = bytes32(0x0f8a2300a7925c586135b1c142dc0b833f20d5c41ea6e815900d65d041e96cf5);
    }
}
