module.exports = async function({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments

  const { deployer, dev } = await getNamedAccounts()

  const choc = await ethers.getContract("ChocToken")

  const { address } = await deploy("EarlyBirdPool", {
    from: dev,
    args: [choc.address, 432000],
    log: true,
    deterministicDeployment: false,
  })

  if ((await choc.minter()) !== address) {
    console.log("Transfer Choc Minter role to EarlyBirdPool")
    await (await choc.setMinter(address)).wait()
  }
}

module.exports.tags = ["EarlyBirdPool"]
module.exports.dependencies = [
  "UniswapV2Factory",
  "UniswapV2Router02",
  "ChocToken",
]
