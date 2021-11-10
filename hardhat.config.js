// hardhat.config.js
require("dotenv/config")
require("@nomiclabs/hardhat-solhint")
// require("@nomiclabs/hardhat-solpp")
require("@nomiclabs/hardhat-waffle")
require("hardhat-abi-exporter")
require("hardhat-deploy")
require("hardhat-deploy-ethers")
require("hardhat-gas-reporter")
require("hardhat-spdx-license-identifier")
require("hardhat-watcher")
require("solidity-coverage")

const { task } = require("hardhat/config")

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

const { removeConsoleLog } = require("hardhat-preprocessor")

const accounts = {
  mnemonic: process.env.MNEMONIC,
  path: "m/44'/60'/0'/0",
}

module.exports = {
  abiExporter: {
    path: "./build/abi",
    //clear: true,
    flat: true,
    // only: [],
    // except: []
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    dev: {
      // Default to 1
      default: 1,
      // dev address mainnet
      // 1: "",
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      accounts,
      mining: {
        auto: true,
        interval: 6000,
      },
      gasPrice: 100,
      initialBaseFeePerGas: 100,
    },
    Amber: {
      url: `http://35.220.203.194:8545`,
      accounts,
      chainId: 10001,
      live: true,
      saveDeployments: true,
    },
  },
  preprocess: {
    eachLine: removeConsoleLog(
      bre => bre.network.name !== "hardhat" && bre.network.name !== "localhost"
    ),
  },
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 5000,
      },
    },
  },
  spdxLicenseIdentifier: {
    overwrite: false,
    runOnCompile: true,
  },
  watcher: {
    compile: {
      tasks: ["compile"],
      files: ["./contracts"],
      verbose: true,
    },
  },
}
