module.exports = async function({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments

  const { deployer, dev } = await getNamedAccounts()

  const choc = await ethers.getContract("ChocToken")

  const { address } = await deploy("ChocFactory", {
    from: deployer,
    args: [
      choc.address,
      dev,
      // 10 CHOCs per block
      "10000000000000000000",
      "0",
      "1000000000000000000000",
    ],
    log: true,
    deterministicDeployment: false,
  })

  if ((await choc.owner()) !== address) {
    console.log("Transfer Choc Ownership to ChocFactory")
    await (await choc.transferOwnership(address)).wait()
  }

  const chocFactory = await ethers.getContract("ChocFactory")
  if ((await chocFactory.owner()) !== dev) {
    // Transfer ownership of ChocFactory to dev
    console.log("Transfer ownership of ChocFactory to dev")
    await (await chocFactory.transferOwnership(dev)).wait()
  }
}

module.exports.tags = ["ChocFactory"]
module.exports.dependencies = [
  "UniswapV2Factory",
  "UniswapV2Router02",
  "ChocToken",
  "EarlyBirdPool",
]
